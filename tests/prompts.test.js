import colors from "colors"
import { describe, expect, it, vi } from "vitest"

vi.mock("@clack/core", () => {
  const AutocompletePrompt = vi.fn(function (opts) {
    this._opts = opts
  })
  AutocompletePrompt.prototype.prompt = vi.fn(async () => null)
  return { AutocompletePrompt }
})

vi.mock("@clack/prompts", () => ({
  isCancel: vi.fn(),
  limitOptions: vi.fn(({ options, style, cursor }) => options.map((opt, i) => style(opt, i === cursor))),
  password: vi.fn(async () => ""),
  S_BAR: "│",
  S_BAR_END: "└",
  S_CHECKBOX_ACTIVE: "◻",
  S_CHECKBOX_INACTIVE: "◻",
  S_CHECKBOX_SELECTED: "◼",
  S_RADIO_ACTIVE: "●",
  S_RADIO_INACTIVE: "○",
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  symbol: vi.fn((state) => (state === "submit" ? "✔" : state === "cancel" ? "✘" : "?")),
}))

import { AutocompletePrompt } from "@clack/core"
import { isCancel as clackIsCancel, password as clackPassword, spinner as clackSpinner } from "@clack/prompts"
import { isCancel, multiselect, password, select, spinner } from "../prompts.js"

const strip = colors.strip.bind(colors)

const options = [
  { value: "a", label: "Net A", hint: "fast" },
  { value: "b", label: "Net B" },
]

const getRender = () => AutocompletePrompt.mock.calls.at(-1)[0].render

const baseCtx = {
  state: "active",
  userInput: "",
  userInputWithCursor: "",
  filteredOptions: options,
  options,
  selectedValues: [],
  cursor: 0,
  focusedValue: "a",
  error: "",
}

describe("isCancel", () => {
  it("is re-exported from @clack/prompts", () => {
    expect(isCancel).toBe(clackIsCancel)
  })
})

describe("multiselect", () => {
  const opts = { message: "Pick networks", options }

  it("creates an AutocompletePrompt with multiple: true", async () => {
    await multiselect(opts)
    expect(AutocompletePrompt).toHaveBeenCalledWith(expect.objectContaining({ multiple: true }))
  })

  it("uses custom filter when provided", async () => {
    const filter = vi.fn(() => true)
    await multiselect({ ...opts, filter })
    expect(AutocompletePrompt.mock.calls.at(-1)[0].filter).toBe(filter)
  })

  it("uses defaultFilter when no filter provided", async () => {
    await multiselect(opts)
    const { filter } = AutocompletePrompt.mock.calls.at(-1)[0]
    expect(filter("", { label: "Net A", value: "a" })).toBe(true)
    expect(filter("net", { label: "Net A", value: "a" })).toBe(true)
    expect(filter("fast", { label: "Net A", hint: "fast", value: "a" })).toBe(true)
    expect(filter("val-a", { label: "Net A", value: "val-a" })).toBe(true)
    expect(filter("xyz", { label: "Net A", value: "a" })).toBe(false)
    expect(filter("abc", { value: "abc" })).toBe(true)
  })

  describe("render", () => {
    it("renders cancel state", async () => {
      await multiselect(opts)
      const result = strip(getRender().call({ ...baseCtx, state: "cancel" }))
      expect(result).toContain("Pick networks")
    })

    it("renders submit state with selected values", async () => {
      await multiselect(opts)
      const result = strip(
        getRender().call({
          ...baseCtx,
          state: "submit",
          selectedValues: ["a"],
        }),
      )
      expect(result).toContain("Net A")
    })

    it("renders submit state with no selected values", async () => {
      await multiselect(opts)
      const result = strip(getRender().call({ ...baseCtx, state: "submit", selectedValues: [] }))
      expect(result).not.toContain("Net A")
    })

    it("renders default state with options", async () => {
      await multiselect(opts)
      const result = strip(getRender().call(baseCtx))
      expect(result).toContain("Pick networks")
      expect(result).toContain("Net A")
    })

    it("renders error state", async () => {
      await multiselect(opts)
      const ctx = {
        ...baseCtx,
        state: "error",
        userInput: "x",
        filteredOptions: [options[0]],
        error: "Required",
      }
      expect(strip(getRender().call(ctx))).toContain("Required")
    })

    it("renders match count when filtering", async () => {
      await multiselect(opts)
      const ctx = {
        ...baseCtx,
        userInput: "Net",
        userInputWithCursor: "Net|",
        filteredOptions: [options[0]],
      }
      expect(strip(getRender().call(ctx))).toContain("1 match")
    })

    it("renders plural matches", async () => {
      await multiselect(opts)
      const ctx = {
        ...baseCtx,
        userInput: "Net",
        userInputWithCursor: "Net|",
        filteredOptions: options,
      }
      expect(strip(getRender().call(ctx))).not.toContain("match")
    })

    it("renders no matches message when filtering returns empty", async () => {
      await multiselect(opts)
      const ctx = { ...baseCtx, userInput: "xyz", filteredOptions: [] }
      expect(strip(getRender().call(ctx))).toContain("No matches found")
    })

    it("renders selected count", async () => {
      await multiselect(opts)
      const ctx = { ...baseCtx, selectedValues: ["a", "b"] }
      expect(strip(getRender().call(ctx))).toContain("2 selected")
    })

    it("renders selected item style", async () => {
      await multiselect(opts)
      const ctx = { ...baseCtx, selectedValues: ["a"] }
      const result = strip(getRender().call(ctx))
      expect(result).toContain("◼")
    })

    it("uses value as label when option has no label", async () => {
      const noLabelOpts = {
        message: "Pick",
        options: [{ value: "raw-value" }, { value: undefined }],
      }
      await multiselect(noLabelOpts)
      const ctx = {
        ...baseCtx,
        options: noLabelOpts.options,
        filteredOptions: noLabelOpts.options,
        state: "submit",
        selectedValues: ["raw-value", undefined],
      }
      const result = strip(getRender().call(ctx))
      expect(result).toContain("raw-value")
    })
  })
})

describe("password", () => {
  it("is re-exported from @clack/prompts", () => {
    expect(password).toBe(clackPassword)
  })
})

describe("select", () => {
  const opts = { message: "Select a network", options }

  it("creates an AutocompletePrompt", async () => {
    await select(opts)
    expect(AutocompletePrompt).toHaveBeenCalled()
  })

  it("sets initialValue when provided", async () => {
    await select({ ...opts, initialValue: "a" })
    expect(AutocompletePrompt.mock.calls.at(-1)[0].initialValue).toEqual(["a"])
  })

  it("uses undefined initialValue when not provided", async () => {
    await select(opts)
    expect(AutocompletePrompt.mock.calls.at(-1)[0].initialValue).toBeUndefined()
  })

  it("uses custom filter when provided", async () => {
    const filter = vi.fn(() => true)
    await select({ ...opts, filter })
    expect(AutocompletePrompt.mock.calls.at(-1)[0].filter).toBe(filter)
  })

  it("uses defaultFilter when no filter provided", async () => {
    await select(opts)
    const { filter } = AutocompletePrompt.mock.calls.at(-1)[0]
    expect(filter("", { label: "anything", value: "x" })).toBe(true)
    expect(filter("net", { label: "Net A", value: "a" })).toBe(true)
    expect(filter("xyz", { label: "Net A", value: "a" })).toBe(false)
  })

  describe("render", () => {
    it("renders cancel state", async () => {
      await select(opts)
      const result = strip(getRender().call({ ...baseCtx, state: "cancel" }))
      expect(result).toContain("Select a network")
    })

    it("renders submit state with selected value", async () => {
      await select(opts)
      const result = strip(
        getRender().call({
          ...baseCtx,
          state: "submit",
          selectedValues: ["a"],
        }),
      )
      expect(result).toContain("Net A")
    })

    it("renders submit state with no selected values", async () => {
      await select(opts)
      const result = strip(getRender().call({ ...baseCtx, state: "submit", selectedValues: [] }))
      expect(result).not.toContain("Net A")
    })

    it("renders default state with options", async () => {
      await select(opts)
      const result = strip(getRender().call(baseCtx))
      expect(result).toContain("Select a network")
      expect(result).toContain("Net A")
    })

    it("renders hint for focused option", async () => {
      await select(opts)
      const result = strip(getRender().call({ ...baseCtx, focusedValue: "a", cursor: 0 }))
      expect(result).toContain("fast")
    })

    it("renders no hint for unfocused option", async () => {
      await select(opts)
      const result = strip(getRender().call({ ...baseCtx, focusedValue: "b", cursor: 1 }))
      expect(result).not.toContain("fast")
    })

    it("renders error state", async () => {
      await select(opts)
      const ctx = {
        ...baseCtx,
        state: "error",
        userInput: "x",
        filteredOptions: [options[0]],
        error: "Required",
      }
      expect(strip(getRender().call(ctx))).toContain("Required")
    })

    it("renders match count when filtering", async () => {
      await select(opts)
      const ctx = {
        ...baseCtx,
        userInput: "Net",
        userInputWithCursor: "Net|",
        filteredOptions: [options[0]],
      }
      expect(strip(getRender().call(ctx))).toContain("1 match")
    })

    it("renders no matches message", async () => {
      await select(opts)
      const ctx = { ...baseCtx, userInput: "xyz", filteredOptions: [] }
      expect(strip(getRender().call(ctx))).toContain("No matches found")
    })
  })
})

describe("spinner", () => {
  it("is re-exported from @clack/prompts", () => {
    expect(spinner).toBe(clackSpinner)
  })
})
