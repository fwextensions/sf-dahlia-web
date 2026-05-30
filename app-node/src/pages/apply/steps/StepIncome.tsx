/**
 * Step: Income - Household income information.
 */

import type { IncomeFormData } from "../../../lib/apply/types"

interface StepIncomeProps {
  income: IncomeFormData
  onIncomeChange: (data: Partial<IncomeFormData>) => void
  onNext: () => void
  onPrevious: () => void
}

export function StepIncome({ income, onIncomeChange, onNext, onPrevious }: StepIncomeProps) {
  return (
    <section aria-labelledby="step-income-heading">
      <h2 id="step-income-heading">Income</h2>
      <p>Enter your total household income before taxes.</p>

      <fieldset>
        <legend>Income Timeframe</legend>

        <label>
          <input
            type="radio"
            name="incomeTimeframe"
            value="per_year"
            checked={income.incomeTimeframe === "per_year"}
            onChange={() => onIncomeChange({ incomeTimeframe: "per_year" })}
          />
          Per Year
        </label>

        <label>
          <input
            type="radio"
            name="incomeTimeframe"
            value="per_month"
            checked={income.incomeTimeframe === "per_month"}
            onChange={() => onIncomeChange({ incomeTimeframe: "per_month" })}
          />
          Per Month
        </label>
      </fieldset>

      <label htmlFor="incomeTotal">
        Total Income ({income.incomeTimeframe === "per_year" ? "Annual" : "Monthly"})
      </label>
      <input
        id="incomeTotal"
        type="number"
        min={0}
        step={0.01}
        value={income.incomeTotal || ""}
        onChange={(e) => onIncomeChange({ incomeTotal: parseFloat(e.target.value) || 0 })}
      />

      <div>
        <button type="button" onClick={onPrevious}>Previous</button>
        <button type="button" onClick={onNext}>Next</button>
      </div>
    </section>
  )
}
