	// C2-NRED Package Compatibility Finder
	//
	// Target runtime of the C2-NRED module.
	const TARGET_NODE = "14.18.1";
	const TARGET_NODERED = "3.0.2";

	// Packages with hundreds of releases could otherwise spin for minutes.
	const TIME_BUDGET_MS = 60000;
	const MAX_REJECT_ROWS = 12;

	// Node-RED 3.0.2 runs `npm install ... --engine-strict`, so an `engines`
	// mismatch ANYWHERE in the resolved tree is a hard ENOTSUP failure, not a
	// warning. That means we have to resolve the full transitive tree the way
	// npm would - every range to its highest satisfying version - and check
	// `engines` on each one.

	// ---------------------------------------------------------------- semver

	// Tolerates partial versions ("16" -> 16.0.0), which show up inside
	// ranges such as ">= 0.10" and "16 - 20".
	function parseVersion(v) {
		const m = /^[=v\s]*(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z-.]+))?/.exec(String(v));
		if (!m) return null;
		return {
			major: +m[1],
			minor: m[2] === undefined ? 0 : +m[2],
			patch: m[3] === undefined ? 0 : +m[3],
			pre: m[4] ? m[4].split(".") : []
		};
	}

	function comparePre(a, b) {
		if (!a.length && !b.length) return 0;
		if (!a.length) return 1;   // no prerelease sorts higher
		if (!b.length) return -1;
		for (let i = 0; i < Math.max(a.length, b.length); i++) {
			const x = a[i], y = b[i];
			if (x === undefined) return -1;
			if (y === undefined) return 1;
			const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
			if (nx && ny) { if (+x !== +y) return +x < +y ? -1 : 1; }
			else if (nx) return -1;
			else if (ny) return 1;
			else if (x !== y) return x < y ? -1 : 1;
		}
		return 0;
	}

	function compareVersions(a, b) {
		const pa = typeof a === "string" ? parseVersion(a) : a;
		const pb = typeof b === "string" ? parseVersion(b) : b;
		if (!pa || !pb) return 0;
		for (const k of ["major", "minor", "patch"]) {
			if (pa[k] !== pb[k]) return pa[k] < pb[k] ? -1 : 1;
		}
		return comparePre(pa.pre, pb.pre);
	}

	// Expand one comparator set (the AND-ed half of a `||` union) into a list
	// of primitive {op, v} comparators.
	function expandComparatorSet(set) {
		const out = [];
		// Close up whitespace between an operator and its version, so that
		// ">= 0.10" tokenises as one comparator rather than two.
		const raw = set.trim().replace(/([<>=~^]+)\s+/g, "$1");
		if (!raw || raw === "*") return out; // matches anything

		// hyphen range: "1.2.3 - 2.3.4"
		const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(raw);
		if (hyphen) {
			const lo = parseVersion(hyphen[1]);
			const hi = parseVersion(hyphen[2]);
			if (lo) out.push({ op: ">=", v: lo });
			if (hi) {
				// "1.2" as an upper bound means "< 1.3.0"
				if (/^\s*\d+\.\d+\.\d+/.test(hyphen[2])) {
					out.push({ op: "<=", v: hi });
				} else {
					out.push({ op: "<", v: { major: hi.major, minor: hi.minor + 1, patch: 0, pre: [] } });
				}
			}
			return out;
		}

		for (const tok of raw.split(/\s+/)) {
			const m = /^(\^|~>|~|>=|<=|>|<|=)?\s*v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z-.]+))?/.exec(tok);
			if (!m) continue;
			const op = m[1] === "~>" ? "~" : (m[1] || "=");
			if (/^[xX*]$/.test(m[2])) continue; // "x" / "*" - no constraint
			const wildMinor = m[3] === undefined || /^[xX*]$/.test(m[3]);
			const wildPatch = m[4] === undefined || /^[xX*]$/.test(m[4]);
			const base = {
				major: +m[2],
				minor: wildMinor ? 0 : +m[3],
				patch: wildPatch ? 0 : +m[4],
				pre: m[5] ? m[5].split(".") : []
			};

			if (op === "^") {
				out.push({ op: ">=", v: base });
				if (base.major > 0 || wildMinor) {
					out.push({ op: "<", v: { major: base.major + 1, minor: 0, patch: 0, pre: [] } });
				} else if (base.minor > 0 || wildPatch) {
					out.push({ op: "<", v: { major: 0, minor: base.minor + 1, patch: 0, pre: [] } });
				} else {
					out.push({ op: "<", v: { major: 0, minor: 0, patch: base.patch + 1, pre: [] } });
				}
			} else if (op === "~") {
				out.push({ op: ">=", v: base });
				if (wildMinor) {
					out.push({ op: "<", v: { major: base.major + 1, minor: 0, patch: 0, pre: [] } });
				} else {
					out.push({ op: "<", v: { major: base.major, minor: base.minor + 1, patch: 0, pre: [] } });
				}
			} else if (op === "=" && (wildMinor || wildPatch)) {
				// "1.2" / "1.2.x" -> >=1.2.0 <1.3.0 ; "1" / "1.x" -> >=1.0.0 <2.0.0
				out.push({ op: ">=", v: base });
				out.push(wildMinor
					? { op: "<", v: { major: base.major + 1, minor: 0, patch: 0, pre: [] } }
					: { op: "<", v: { major: base.major, minor: base.minor + 1, patch: 0, pre: [] } });
			} else {
				out.push({ op: op, v: base });
			}
		}
		return out;
	}

	function satisfies(version, range) {
		const pv = parseVersion(version);
		if (!pv) return false;
		if (range === undefined || range === null) return true;
		const r = String(range).trim();
		if (!r || r === "*" || r === "x" || r === "latest") return true;
		// URLs, git specs and file paths are not semver - treat as unknown/OK.
		if (/^(https?:|git|github:|file:|npm:|link:)/i.test(r)) return true;

		for (const set of r.split("||")) {
			const comps = expandComparatorSet(set);
			if (!comps.length) return true;
			// A prerelease only satisfies a range if the range itself mentions
			// a prerelease on the same [major,minor,patch] tuple.
			if (pv.pre.length) {
				const allowed = comps.some(c => c.v.pre.length &&
					c.v.major === pv.major && c.v.minor === pv.minor && c.v.patch === pv.patch);
				if (!allowed) continue;
			}
			let ok = true;
			for (const c of comps) {
				const cmp = compareVersions(pv, c.v);
				if (c.op === ">=" && !(cmp >= 0)) ok = false;
				else if (c.op === ">" && !(cmp > 0)) ok = false;
				else if (c.op === "<=" && !(cmp <= 0)) ok = false;
				else if (c.op === "<" && !(cmp < 0)) ok = false;
				else if (c.op === "=" && cmp !== 0) ok = false;
				if (!ok) break;
			}
			if (ok) return true;
		}
		return false;
	}

	// What npm would actually install for this range.
	function maxSatisfying(versions, range) {
		let best = null;
		for (const v of versions) {
			if (!satisfies(v, range)) continue;
			if (best === null || compareVersions(v, best) > 0) best = v;
		}
		return best;
	}

	// ------------------------------------------------------------- registry

	const packumentCache = new Map();
	// Packages whose engines we could not read, and why. Surfaced in the result
	// so a green answer is never mistaken for "the whole tree was checked".
	const unverified = new Map();
	let fetchCount = 0;

	// A dependency spec npm resolves from somewhere other than the npm registry.
	// There is no packument to fetch for these.
	const NON_REGISTRY_SPEC = /^(https?:|git|git\+|github:|gitlab:|bitbucket:|file:|link:|workspace:|portal:)/i;

	function getPackument(name) {
		if (packumentCache.has(name)) return packumentCache.get(name);
		const p = (async () => {
			fetchCount++;
			let res;
			try {
				// Abbreviated packument: ~60% smaller, still carries
				// dependencies / optionalDependencies / engines / dist.
				res = await fetch("https://registry.npmjs.org/" + name.replace(/\//g, "%2F"), {
					headers: { Accept: "application/vnd.npm.install-v1+json" }
				});
			} catch (e) {
				// A rejected fetch is a network/CORS failure, not an HTTP status.
				// registry.npmjs.org omits Access-Control-Allow-Origin on 404s for
				// SCOPED names, so a private/unpublished @scope/pkg rejects here and
				// would otherwise abort the entire search.
				unverified.set(name, "not on the npm registry (or blocked by CORS)");
				return null;
			}
			if (!res.ok) {
				unverified.set(name, "registry returned HTTP " + res.status);
				return null;
			}
			try {
				return await res.json();
			} catch (e) {
				unverified.set(name, "malformed registry response");
				return null;
			}
		})();
		packumentCache.set(name, p);
		return p;
	}

	// --------------------------------------------------------- tree walking

	// Returns null if the whole tree is installable, otherwise the first
	// offending package with the path that pulled it in.
	async function findEngineConflict(name, range, path, passed) {
		// Tarball-URL / git / file deps have no packument. Asking the registry for
		// one is both pointless and actively harmful: a scoped miss rejects the
		// fetch. node-red-contrib-modbus depends on @open-p4nr/modbus-serial by
		// Cloudsmith URL, which is what made it fail with "Failed to fetch".
		if (range && NON_REGISTRY_SPEC.test(String(range).trim())) {
			unverified.set(name, "installed from a URL, not the npm registry");
			return null;
		}

		const doc = await getPackument(name);
		// Unknown package (404, private, tarball URL dep) - can't judge, allow.
		if (!doc || !doc.versions) return null;

		const version = maxSatisfying(Object.keys(doc.versions), range);
		if (!version) {
			return {
				name: name,
				version: String(range),
				required: "no published version satisfies this range",
				path: path.slice()
			};
		}

		const key = name + "@" + version;
		if (passed.has(key)) return null;
		passed.add(key); // also breaks dependency cycles

		const pkg = doc.versions[version];
		const eng = pkg.engines || {};
		const here = path.concat(key);

		if (eng.node && !satisfies(TARGET_NODE, eng.node)) {
			passed.delete(key);
			return { name: name, version: version, required: "node " + eng.node, path: here };
		}
		if (eng["node-red"] && !satisfies(TARGET_NODERED, eng["node-red"])) {
			passed.delete(key);
			return { name: name, version: version, required: "node-red " + eng["node-red"], path: here };
		}

		// npm skips optional dependencies that fail their engine check, so they
		// are not install blockers. peerDependencies are not auto-installed by
		// npm 6, so they are not walked either.
		const optional = pkg.optionalDependencies || {};
		const deps = pkg.dependencies || {};
		for (const dep of Object.keys(deps)) {
			if (Object.prototype.hasOwnProperty.call(optional, dep)) continue;
			const conflict = await findEngineConflict(dep, deps[dep], here, passed);
			if (conflict) {
				passed.delete(key);
				return conflict;
			}
		}
		return null;
	}

	// ------------------------------------------------------------------ UI

	const packageInput = document.getElementById("packageName");
	const viewNpmButton = document.getElementById("viewNpmButton");

	packageInput.addEventListener("input", () => {
		viewNpmButton.disabled = true;
	});

	function esc(s) {
		return String(s).replace(/[&<>"']/g, c =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
	}

	function renderUnverified() {
		if (!unverified.size) return "";
		let html = "<p style='color:#b36b00'>&#9888; " + unverified.size +
			" package" + (unverified.size === 1 ? " was" : "s were") +
			" not checked &mdash; the result above covers the rest of the tree only.</p>" +
			"<table><tr><th>Package</th><th>Reason</th></tr>";
		unverified.forEach(function (reason, name) {
			html += "<tr><td>" + esc(name) + "</td><td>" + esc(reason) + "</td></tr>";
		});
		return html + "</table>";
	}

	function renderRejected(rejected) {
		if (!rejected.length) return "";
		let html = "<details><summary>Why newer versions were rejected (" +
			rejected.length + ")</summary><table><tr><th>Version</th>" +
			"<th>Blocked by</th><th>Requires</th><th>Pulled in via</th></tr>";
		for (const r of rejected.slice(0, MAX_REJECT_ROWS)) {
			html += "<tr><td>" + esc(r.version) + "</td><td>" +
				esc(r.conflict.name + "@" + r.conflict.version) + "</td><td>" +
				esc(r.conflict.required) + "</td><td style='font-size:0.85em'>" +
				r.conflict.path.map(esc).join(" &rsaquo; ") + "</td></tr>";
		}
		if (rejected.length > MAX_REJECT_ROWS) {
			html += "<tr><td colspan='4'>&hellip; and " +
				(rejected.length - MAX_REJECT_ROWS) + " older versions</td></tr>";
		}
		return html + "</table></details>";
	}

	async function findCompatibleVersion() {
		document.body.classList.add("waiting");

		const packageName = document.getElementById("packageName").value.trim();
		const resultDiv = document.getElementById("result");

		if (!packageName) {
			resultDiv.innerHTML = "<p style='color: red;'>Please enter a package name.</p>";
			document.body.classList.remove("waiting");
			return;
		}

		packumentCache.clear();
		unverified.clear();
		fetchCount = 0;

		try {
			const data = await getPackument(packageName);
			if (!data || !data.versions) throw new Error("Package not found.");

			// Sort by semver, newest first - do NOT rely on registry key order,
			// which is publish order (a patch to an old line can be published
			// after a new major).
			const allVersions = Object.keys(data.versions)
				.filter(v => { const p = parseVersion(v); return p && !p.pre.length; })
				.sort((a, b) => compareVersions(b, a));

			if (!allVersions.length) throw new Error("No stable versions published.");
			const highestVersion = allVersions[0];

			let bestMatch = null;
			let timedOut = false;
			const rejected = [];
			const deadline = Date.now() + TIME_BUDGET_MS;

			for (const version of allVersions) {
				if (Date.now() > deadline) { timedOut = true; break; }

				resultDiv.innerHTML = "<p>Resolving dependency tree for <strong>" +
					esc(packageName) + "@" + esc(version) + "</strong>&hellip; (" +
					fetchCount + " packages queried, " + rejected.length + " versions ruled out)</p>";

				const conflict = await findEngineConflict(packageName, version, [], new Set());
				if (!conflict) { bestMatch = version; break; }

				rejected.push({ version: version, conflict: conflict });
			}

			if (bestMatch) {
				const bestPkg = data.versions[bestMatch];
				const fileName = packageName.startsWith("@") ? packageName.split("/")[1] : packageName;
				const downloadUrl = (bestPkg && bestPkg.dist && bestPkg.dist.tarball) ||
					("https://registry.npmjs.org/" + encodeURIComponent(packageName) +
					 "/-/" + fileName + "-" + bestMatch + ".tgz");
				const npmUrl = "https://www.npmjs.com/package/" + packageName + "/v/" + bestMatch;

				viewNpmButton.onclick = () => window.open(npmUrl, "_blank");
				viewNpmButton.disabled = false;

				let html = "<p style='color: green;'>&#10004; The best compatible version of <strong>" +
					esc(packageName) + "</strong> is <strong>v" + esc(bestMatch) +
					"</strong>, which works with Node.js " + TARGET_NODE +
					" and Node-RED " + TARGET_NODERED + ".</p>" +
					"<h3>" + esc(downloadUrl) + "</h3>" +
					"<p>Copy the above URL into your browser or click this link to</p>" +
					"<p><a href='" + esc(downloadUrl) + "' target='_blank'>Download the package (v" +
					esc(bestMatch) + ")</a></p>";
				html += renderUnverified();
				if (bestMatch !== highestVersion) html += renderRejected(rejected);
				resultDiv.innerHTML = html;

				if (typeof gtag === "function") {
					gtag("event", "find_compatible_version_click", {
						event_category: "Package Search",
						event_label: "Compatibility Check",
						package_name: packageName,
						compatible_version: bestMatch,
						highest_version: highestVersion
					});
				}
			} else {
				resultDiv.innerHTML =
					"<p style='color: red;'>&#10008; " + (timedOut
						? "Gave up after checking the newest " + rejected.length + " versions of <strong>" +
						  esc(packageName) + "</strong> &mdash; none work with Node.js " + TARGET_NODE +
						  " and Node-RED " + TARGET_NODERED + ". Older versions may, but were not checked."
						: "No compatible version of <strong>" + esc(packageName) +
						  "</strong> found for Node.js " + TARGET_NODE +
						  " and Node-RED " + TARGET_NODERED + ".") +
					"</p>" + renderUnverified() + renderRejected(rejected);

				if (typeof gtag === "function") {
					gtag("event", "find_compatible_version_click", {
						event_category: "Package Search",
						event_label: "Compatibility Check",
						package_name: packageName,
						compatible_version: "none",
						highest_version: highestVersion
					});
				}
			}
		} catch (error) {
			document.getElementById("result").innerHTML =
				"<p style='color: red;'>Error: " + esc(error.message) + "</p>";
		} finally {
			document.body.classList.remove("waiting");
		}
	}
