let pages: string[] = []
let pageTitles: Record<string, string> = {}

export function setPageList(list: string[]) {
  pages = list
}

export function getPageList(): string[] {
  return pages
}

export function setPageTitles(titles: Record<string, string>) {
  pageTitles = titles
}

export function getPageTitles(): Record<string, string> {
  return pageTitles
}
