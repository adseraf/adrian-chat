module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  try {
    // Normalize URL
    let fetchUrl = url.trim();
    if (!fetchUrl.startsWith("http")) {
      fetchUrl = "https://" + fetchUrl;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MarketingAnalyzer/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pl,en;q=0.9"
      }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(200).json({ content: "", error: "Could not fetch site" });
    }

    const html = await response.text();

    // Strip HTML tags, scripts, styles - extract text content
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, " [HEADER] ")
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n## $1\n")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    // Limit to ~8000 chars
    if (text.length > 8000) {
      text = text.substring(0, 8000) + "...";
    }

    // Also extract meta description and title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);

    const title = titleMatch ? titleMatch[1].trim() : "";
    const description = descMatch ? descMatch[1].trim() : (ogDescMatch ? ogDescMatch[1].trim() : "");

    let enrichedContent = "";
    if (title) enrichedContent += `Tytuł strony: ${title}\n`;
    if (description) enrichedContent += `Opis: ${description}\n\n`;
    enrichedContent += text;

    return res.status(200).json({ content: enrichedContent });
  } catch (error) {
    console.error("Fetch site error:", error.message);
    return res.status(200).json({ content: "", error: "Could not fetch site: " + error.message });
  }
};
