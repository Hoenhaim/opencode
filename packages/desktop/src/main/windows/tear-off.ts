export type TearOffRect = { x: number; y: number; width: number; height: number }
export type TearOffPoint = { x: number; y: number }

export const TEAR_OFF_WINDOW_OFFSET = 32

const cursorXInset = 160
const cursorYInset = 22
const defaultWidth = 1280
const defaultHeight = 800

export function tearOffWindowBounds(input: {
  source: TearOffRect
  placement: "cursor" | "offset"
  cursor: TearOffPoint
  workArea: TearOffRect
}): TearOffRect {
  const width = Math.min(input.source.width > 0 ? input.source.width : defaultWidth, Math.max(input.workArea.width, 1))
  const height = Math.min(
    input.source.height > 0 ? input.source.height : defaultHeight,
    Math.max(input.workArea.height, 1),
  )
  const x = input.placement === "cursor" ? input.cursor.x - cursorXInset : input.source.x + TEAR_OFF_WINDOW_OFFSET
  const y = input.placement === "cursor" ? input.cursor.y - cursorYInset : input.source.y + TEAR_OFF_WINDOW_OFFSET
  return {
    x: clamp(x, input.workArea.x, input.workArea.x + input.workArea.width - width),
    y: clamp(y, input.workArea.y, input.workArea.y + input.workArea.height - height),
    width,
    height,
  }
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min
  if (value < min) return min
  if (value > max) return max
  return value
}
