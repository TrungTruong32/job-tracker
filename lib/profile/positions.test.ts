import { describe, expect, it } from "vitest"
import { positionsForNew, swapPositions } from "./positions"

describe("positionsForNew", () => {
  it("puts new experience above existing ones, keeping their order", () => {
    expect(positionsForNew("experience", [0, 1, 2], 2)).toEqual([-2, -1])
    expect(positionsForNew("experience", [-3, 5], 1)).toEqual([-4])
  })

  it("appends skills at the end", () => {
    expect(positionsForNew("skill", [0, 4], 2)).toEqual([5, 6])
    expect(positionsForNew("skill", [], 2)).toEqual([0, 1])
  })

  it("returns [] for zero items", () => {
    expect(positionsForNew("skill", [1], 0)).toEqual([])
  })
})

describe("swapPositions", () => {
  const list = [
    { id: "a", position: 0 },
    { id: "b", position: 3 },
    { id: "c", position: 7 },
  ]

  it("swaps with the neighbour", () => {
    expect(swapPositions(list, "b", -1)).toEqual([
      { id: "b", position: 0 },
      { id: "a", position: 3 },
    ])
  })

  it("does nothing at the edges", () => {
    expect(swapPositions(list, "a", -1)).toEqual([])
    expect(swapPositions(list, "c", 1)).toEqual([])
  })

  it("separates equal positions so the move is visible", () => {
    const same = [
      { id: "a", position: 0 },
      { id: "b", position: 0 },
    ]
    expect(swapPositions(same, "b", -1)).toEqual([
      { id: "b", position: -1 },
      { id: "a", position: 0 },
    ])
  })
})
