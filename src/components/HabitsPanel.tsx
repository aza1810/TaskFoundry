import { useState, type FormEvent } from 'react'
import { HABIT_REWARDS } from '../game/data'
import { useGame } from '../game/GameContext'
import type { HabitCategory } from '../game/types'

const CATEGORIES: { id: HabitCategory; label: string }[] = [
  { id: 'mining', label: 'Mining' },
  { id: 'smelting', label: 'Smelting' },
  { id: 'assembly', label: 'Assembly' },
  { id: 'research', label: 'Research' },
  { id: 'logistics', label: 'Logistics' },
]

export function HabitsPanel() {
  const { state, completeHabit, addHabit, removeHabit } = useGame()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<HabitCategory>('assembly')
  const done = state.habits.filter((h) => h.completedToday).length

  function onAdd(e: FormEvent) {
    e.preventDefault()
    addHabit(title, category)
    setTitle('')
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Habit Line</h2>
        <p>
          Check items off the line. Each category feeds a different part of the factory.
          Streaks raise throughput.
        </p>
        <p className="panel-stat">
          Today {done}/{state.habits.length} · Lifetime {state.totalHabitsCompleted}
        </p>
      </div>

      <ul className="habit-list">
        {state.habits.map((habit) => {
          const reward = HABIT_REWARDS[habit.category]
          return (
            <li
              key={habit.id}
              className={`habit ${habit.completedToday ? 'is-done' : ''}`}
            >
              <button
                type="button"
                className="habit-check"
                disabled={habit.completedToday}
                onClick={() => completeHabit(habit.id)}
                aria-label={`Complete ${habit.title}`}
              >
                <span className="check-box" />
              </button>
              <div className="habit-body">
                <div className="habit-title-row">
                  <span className="habit-title">{habit.title}</span>
                  <span className={`chip chip-${habit.category}`}>
                    {habit.category}
                  </span>
                </div>
                <p className="habit-meta">
                  Streak {habit.streak} · +{reward.xp} XP
                  {habit.completedToday ? ' · stamped' : ''}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeHabit(habit.id)}
                aria-label={`Remove ${habit.title}`}
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>

      <form className="add-habit" onSubmit={onAdd}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New habit on the belt…"
          maxLength={48}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as HabitCategory)}
          aria-label="Habit category"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button type="submit" className="primary-btn">
          Add
        </button>
      </form>
    </section>
  )
}
