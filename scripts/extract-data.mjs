import fs from "node:fs";

const raw = fs.readFileSync("/tmp/faang.html", "utf8");
const bodyMatch = raw.match(/body_html\\":\\"([\s\S]*?)\\",\\"truncated_body_text/);

if (!bodyMatch) {
  throw new Error("Could not find body_html in downloaded Substack HTML.");
}

const bodyHtml = JSON.parse(`"${bodyMatch[1]}"`);
const normalizedHtml = bodyHtml
  .replace(/<strong>|<\/strong>|<em>|<\/em>/g, "")
  .replace(/&amp;/g, "&")
  .replace(/&nbsp;/g, " ");

const headings = [
  ...normalizedHtml.matchAll(/<h1[^>]*>(.*?)<\/h1>|<h3[^>]*>(.*?)<\/h3>/g),
];

let week = "";
const roadmap = [];

function stripTags(value) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/[\u2705\ud83c\udfaf\ud83d\uddd3\ufe0f]/g, "")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

for (let index = 0; index < headings.length; index += 1) {
  const match = headings[index];
  const text = stripTags(match[1] || match[2] || "");

  if (match[1] && text.startsWith("Week")) {
    week = text;
    continue;
  }

  if (!match[2] || !text.startsWith("Day ")) {
    continue;
  }

  const dayMatch = text.match(/^Day (\d+(?:[-]\d+)?)\s*-\s*(.*)$/);
  if (!dayMatch) {
    continue;
  }

  const segment = normalizedHtml.slice(
    match.index + match[0].length,
    headings[index + 1]?.index ?? normalizedHtml.length,
  );

  const questions = [...segment.matchAll(/<li><p>(.*?)<\/p><\/li>/g)].flatMap((itemMatch) => {
    const itemHtml = itemMatch[1].replace(/<br\s*\/?\s*>/g, " ").trim();
    const links = [...itemHtml.matchAll(/<a href=\\"([^"]+)\\">(.*?)<\/a>/g)].map((link) => ({
      title: stripTags(link[2]),
      url: link[1],
    }));

    if (links.length > 1) {
      return links.map((link) => ({ ...link, note: "" }));
    }

    if (links.length === 1) {
      const note = stripTags(itemHtml.replace(/<a href=\\"[^"]+\\">.*?<\/a>/g, ""))
        .replace(/^&\s*/, "")
        .trim();
      return [{ ...links[0], note }];
    }

    return [{ title: stripTags(itemHtml), url: "", note: "" }];
  });

  roadmap.push({
    day: dayMatch[1],
    title: dayMatch[2],
    week,
    questions,
  });
}

const output = `const ROADMAP = ${JSON.stringify(roadmap, null, 2)};\n`;
fs.writeFileSync("data.js", output);

console.log(`Generated ${roadmap.length} day groups with ${roadmap.reduce((sum, day) => sum + day.questions.length, 0)} tasks.`);
