import { $ctx } from "@milkdown/kit/utils"

export interface MenuAPI {
  show: (pos: number) => void
  hide: () => void
}

export const menuAPI = $ctx(
  { show: () => {}, hide: () => {} } as MenuAPI,
  "menuAPICtx"
)
