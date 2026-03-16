import { AutocompletePrompt } from "@clack/core"
import * as prompts from "@clack/prompts"

const label = (opt) => opt.label ?? String(opt.value ?? "")

const defaultFilter = (search, option) => {
  if (!search) return true
  const s = search.toLowerCase()
  return [option.label ?? "", option.hint ?? "", String(option.value)].some((v) => v.toLowerCase().includes(s))
}

const isCancel = prompts.isCancel

const password = prompts.password

const select = (opts) => {
  return new AutocompletePrompt({
    options: opts.options,
    initialValue: opts.initialValue ? [opts.initialValue] : undefined,
    filter: opts.filter ?? defaultFilter,
    signal: opts.signal,
    input: opts.input,
    output: opts.output,
    validate: opts.validate,
    render() {
      const bar = `${prompts.S_BAR.cyan}  `
      const input = this.userInput
      const matchCount =
        this.filteredOptions.length !== this.options.length
          ? ` (${this.filteredOptions.length} match${this.filteredOptions.length === 1 ? "" : "es"})`.grey
          : ""
      const message = input ? `${opts.message}: ${this.userInputWithCursor}${matchCount}` : opts.message
      const s = [`${prompts.symbol(this.state)}  ${message}`]

      switch (this.state) {
        case "submit": {
          const selected = this.selectedValues
            .map((v) => opts.options.find((o) => o.value === v))
            .filter(Boolean)
            .map(label)
          return `${s[0]}\n${prompts.S_BAR.grey}${selected.length ? `  ${selected.join(", ").grey}` : ""}`
        }
        case "cancel":
          return `${s[0]}\n${prompts.S_BAR.grey}`
        default: {
          const noMatches = this.filteredOptions.length === 0 && input ? [`${bar}${"No matches found".yellow}`] : []
          const error = this.state === "error" ? [`${bar}${this.error.yellow}`] : []
          if (input) s.push(...noMatches, ...error)

          const items = prompts.limitOptions({
            cursor: this.cursor,
            options: this.filteredOptions,
            columnPadding: 3,
            rowPadding: s.length + 1,
            style: (opt, active) => {
              const l = label(opt)
              const hint = opt.hint && opt.value === this.focusedValue ? ` (${opt.hint})`.grey : ""
              return active ? `${prompts.S_RADIO_ACTIVE.green} ${l}${hint}` : `${prompts.S_RADIO_INACTIVE.grey} ${l.grey}`
            },
            maxItems: opts.maxItems ?? 20,
            output: opts.output,
          })

          return [...s, ...items.map((i) => `${bar}${i}`), prompts.S_BAR_END.cyan].join("\n")
        }
      }
    },
  }).prompt()
}

const multiselect = (opts) => {
  return new AutocompletePrompt({
    options: opts.options,
    multiple: true,
    filter: opts.filter ?? defaultFilter,
    signal: opts.signal,
    input: opts.input,
    output: opts.output,
    validate: opts.validate,
    render() {
      const bar = `${prompts.S_BAR.cyan}  `
      const input = this.userInput
      const matchCount =
        this.filteredOptions.length !== this.options.length
          ? ` (${this.filteredOptions.length} match${this.filteredOptions.length === 1 ? "" : "es"})`.grey
          : ""
      const selCount = this.selectedValues.length > 0 ? ` (${this.selectedValues.length} selected)`.grey : ""
      const message = input ? `${opts.message}: ${this.userInputWithCursor}${matchCount}${selCount}` : `${opts.message}${selCount}`
      const s = [`${prompts.symbol(this.state)}  ${message}`]

      switch (this.state) {
        case "submit": {
          const selected = this.selectedValues
            .map((v) => opts.options.find((o) => o.value === v))
            .filter(Boolean)
            .map(label)
          return `${s[0]}\n${prompts.S_BAR.grey}${selected.length ? `  ${selected.join(", ").grey}` : ""}`
        }
        case "cancel":
          return `${s[0]}\n${prompts.S_BAR.grey}`
        default: {
          const noMatches = this.filteredOptions.length === 0 && input ? [`${bar}${"No matches found".yellow}`] : []
          const error = this.state === "error" ? [`${bar}${this.error.yellow}`] : []
          if (input) s.push(...noMatches, ...error)

          const items = prompts.limitOptions({
            cursor: this.cursor,
            options: this.filteredOptions,
            columnPadding: 3,
            rowPadding: s.length + 1,
            style: (opt, active) => {
              const l = label(opt)
              const selected = this.selectedValues.includes(opt.value)
              if (selected) return `${prompts.S_CHECKBOX_SELECTED.green} ${l}`
              return active ? `${prompts.S_CHECKBOX_ACTIVE.grey} ${l}` : `${prompts.S_CHECKBOX_INACTIVE.grey} ${l.grey}`
            },
            maxItems: opts.maxItems ?? 20,
            output: opts.output,
          })

          return [...s, ...items.map((i) => `${bar}${i}`), prompts.S_BAR_END.cyan].join("\n")
        }
      }
    },
  }).prompt()
}

const spinner = prompts.spinner

export { isCancel, multiselect, password, select, spinner }
