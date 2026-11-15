// Loads the JSON data files that ship with the site. Relative URLs keep this working under any base path.
const url = (file) => new URL("../data/" + file, import.meta.url);

async function get(file) {
  const res = await fetch(url(file));
  if (!res.ok) throw new Error("Request failed: " + file + " (" + res.status + ")");
  return res.json();
}

export const Api = {
  modules: () => get("modules.json"),
  papers: () => get("papers.json")
};
