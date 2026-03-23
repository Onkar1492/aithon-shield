/**
 * Threat Feed Service
 * Integrates with public threat intelligence APIs (NIST NVD, CISA KEV)
 */

export interface ThreatItem {
  id: string;
  title: string;
  source: string;
  severity: string;
  published: string;
  affected: string;
  description?: string;
  url?: string;
}

/**
 * Fetch recent vulnerabilities from NIST NVD API
 */
async function fetchNISTVulnerabilities(): Promise<ThreatItem[]> {
  try {
    // NIST NVD 2.0 API - public, no API key required for limited requests
    const response = await fetch(
      "https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=5",
      {
        headers: {
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`NIST NVD API error: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    return data.vulnerabilities?.slice(0, 3).map((vuln: any) => {
      const cve = vuln.cve;
      const severity = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || 
                      cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseSeverity || 
                      "UNKNOWN";
      
      const description = cve.descriptions?.find((d: any) => d.lang === "en")?.value || "";
      const publishedDate = new Date(cve.published).toLocaleDateString();
      
      // Extract affected products
      let affected = "Multiple products";
      if (cve.configurations?.nodes?.[0]?.cpeMatch?.[0]?.criteria) {
        const cpe = cve.configurations.nodes[0].cpeMatch[0].criteria;
        const parts = cpe.split(":");
        if (parts.length > 4) {
          affected = `${parts[3]} ${parts[4] || ""}`.trim();
        }
      }

      return {
        id: cve.id,
        title: description.substring(0, 80) + (description.length > 80 ? "..." : ""),
        source: "NIST NVD",
        severity: severity.toUpperCase(),
        published: publishedDate,
        affected,
        description,
        url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      };
    }) || [];
  } catch (error) {
    console.error("Error fetching NIST vulnerabilities:", error);
    return [];
  }
}

/**
 * Fetch known exploited vulnerabilities from CISA KEV
 */
async function fetchCISAKEVulnerabilities(): Promise<ThreatItem[]> {
  try {
    // CISA KEV API - public, no authentication required
    const response = await fetch(
      "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
    );

    if (!response.ok) {
      console.error(`CISA KEV API error: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    
    return data.vulnerabilities?.slice(0, 2).map((vuln: any) => {
      const addedDate = new Date(vuln.dateAdded).toLocaleDateString();
      
      return {
        id: vuln.cveID,
        title: vuln.vulnerabilityName || vuln.shortDescription,
        source: "CISA KEV",
        severity: "HIGH", // CISA KEV only includes high-impact vulnerabilities
        published: addedDate,
        affected: vuln.product || "Unknown",
        description: vuln.shortDescription,
        url: `https://www.cvedetails.com/cve/${vuln.cveID}/`,
      };
    }) || [];
  } catch (error) {
    console.error("Error fetching CISA KEV:", error);
    return [];
  }
}

/**
 * Fetch consolidated threat intelligence from all sources
 */
export async function fetchThreatIntelligence(): Promise<ThreatItem[]> {
  const [nistThreats, cisaThreats] = await Promise.all([
    fetchNISTVulnerabilities(),
    fetchCISAKEVulnerabilities(),
  ]);

  // Combine and sort by published date (most recent first)
  const allThreats = [...nistThreats, ...cisaThreats];
  
  // Sort by published date (most recent first)
  allThreats.sort((a, b) => {
    const dateA = new Date(a.published);
    const dateB = new Date(b.published);
    return dateB.getTime() - dateA.getTime();
  });
  
  return allThreats.slice(0, 5); // Return top 5 most recent
}
