        async function findCompatibleVersion() {
            const packageName = document.getElementById("packageName").value.trim();
            const resultDiv = document.getElementById("result");
	    const packageInput = document.getElementById('packageName').value;

	    // 🔥 Google Analytics custom event
	    gtag('event', 'find_compatible_version_click', {
	      'event_category': 'Package Search',
	      'event_label': 'Package Name Entry',
	      'value': packageInput
	    });
		
            if (!packageName) {
                resultDiv.innerHTML = "<p style='color: red;'>Please enter a package name.</p>";
                return;
            }

            try {
                const response = await fetch(`https://registry.npmjs.org/${packageName}`);
                if (!response.ok) throw new Error("Package not found.");

                const data = await response.json();
                let allVersions;
				if(data.versions!=undefined)
					allVersions = Object.keys(data.versions);
				else {
					throw new Error("Package not found.");
				}
                let bestMatch = null;

                for (let version of allVersions.reverse()) { // Iterate from newest to oldest
                    const packageInfo = data.versions[version];
                    const requiredNodeVersion = packageInfo.engines?.node || "Unknown";
                    const requiredNRVersion = packageInfo.engines?.["node-red"] || "Unknown";
                    const dependencies = packageInfo.dependencies || {};

                    // Check compatibility of module with Node.js and Node-RED
                    if (isCompatible(requiredNodeVersion, "14.18.1") && isCompatible(requiredNRVersion, "3.0.2")) {
						let dependencyname = "";
						let dependencyver = "";
						let goodDependencies = true;				
						//iterate through each dependency.  If not compatible, break and check next module version
						for (let x in dependencies) {
							dependencyname = x;
							if((dependencies[x].slice(0,1)!="~") && (dependencies[x].slice(0,1)!="^"))
								dependencyname="~vm2";
							dependencyver = dependencies[x].replace("^", "").replace("~", "").trim();
							const response = await fetch(`https://registry.npmjs.org/${dependencyname}`);
							if (response.ok) {
								const data = await response.json();
								const packageInfo = data.versions[dependencyver];
								const requiredNodeVersion = packageInfo.engines?.node || "Unknown";
								const requiredNRVersion = packageInfo.engines?.["node-red"] || "Unknown";
								// Check compatibility of dependency
								if (!isCompatible(requiredNodeVersion, "14.18.1") || !isCompatible(requiredNRVersion, "3.0.2")) {
									goodDependencies=false;	
									break;
								}
							} 
						}
						if(goodDependencies) {	//Once all dependencies are good, you have a good module version
							bestMatch = version;
							break;
						}
                    }
                }

                if (bestMatch) {
                    const downloadUrl = `https://registry.npmjs.org/${packageName}/-/${packageName}-${bestMatch}.tgz`;
                    resultDiv.innerHTML = `
                        <p style='color: green;'>✔ The best compatible version of <strong>${packageName}</strong> is <strong>v${bestMatch}</strong>, which works with Node.js 14.18.1 and Node-RED 3.0.2.</p>
                        <h3>${downloadUrl}</h3>
			<p>Copy the above URL into your browser or click this link to</p>
			<p><a href="${downloadUrl}" target="_blank">Download the package (v${bestMatch})</a></p>
                    `;
                } else {
                    resultDiv.innerHTML = `<p style='color: red;'>✘ No compatible version of <strong>${packageName}</strong> found for Node.js 14.18.1 and Node-RED 3.0.2.</p>`;
                }
            } catch (error) {
                resultDiv.innerHTML = `<p style='color: red;'>Error: ${error.message}</p>`;
            }
        }

		function padArray(arr) {
			while (arr.length < 3) {
				arr.splice(arr.length, 0, '0');
			}
			return arr.map(Number);
		}
  
		function isCompatible(required, current) {
            let reqarray=[];
			let curarray=[];
			if (!required || required === "Unknown") return true;
            if (required.startsWith(">=")) {
				required = required.replace(">=", "").trim();
				reqarray = padArray(required.split("."));
				curarray = padArray(current.split("."));
				for (let i = 0; i<3 ; i++) {
					if (curarray[i]<reqarray[i])
						return false;
					if (curarray[i]>reqarray[i])
						return true;
				}
				return true;
			}
            if (required.startsWith(">")) {
				required = required.replace(">", "").trim();
				reqarray = padArray(required.split("."));
				curarray = padArray(current.split("."));
				for (let i = 0; i<3 ; i++) {
					if (curarray[i]<reqarray[i])
						return false;
					if (curarray[i]>reqarray[i])
						return true;
				}
				return false;
			}
	        if (required.startsWith("<=")) {
				required = required.replace(">=", "").trim();
				reqarray = padArray(required.split("."));
				curarray = padArray(current.split("."));
				for (let i = 0; i<3 ; i++) {
					if (curarray[i]<reqarray[i])
						return true;
					if (curarray[i]>reqarray[i])
						return false;
				}
				return true;
			}
            if (required.startsWith("<")) {
				required = required.replace(">=", "").trim();
				reqarray = padArray(required.split("."));
				curarray = padArray(current.split("."));
				for (let i = 0; i<3 ; i++) {
					if (curarray[i]<reqarray[i])
						return true;
					if (curarray[i]>reqarray[i])
						return false;
				}
				return false;
			}
            if (required.startsWith("^") || required.startsWith("~")) return checkCaretTilde(required, current);
            return current === required;
        }

        function checkCaretTilde(required, current) {
            let minVersion = required.replace("^", "").replace("~", "").trim();
            return current.startsWith(minVersion.split(".")[0]); // Approximate match
        }
