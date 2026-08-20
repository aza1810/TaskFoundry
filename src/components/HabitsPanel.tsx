import { useState, type FormEvent } from 'react'
import { HABIT_REWARDS, ITEM_META, formatNum } from '../game/data'
import { useGame } from '../game/GameContext'
import { ItemSprite } from '../sprites/Sprites'
import type { HabitCategory, ItemId } from '../game/types'

function RewardIcons({ items }: { items: Partial<Record<ItemId, number>> }) {
  const parts = (Object.entries(items) as [ItemId, number][]).filter(
    ([, n]) => (n ?? 0) > 0,
  )
  return (
    <p className="habit-reward">
      {parts.map(([id, n]) => (
        <span className="reward-tag" key={id} title={ITEM_META[id].label}>
          <span className="reward-tag-icon">
            <ItemSprite item={id} />
          </span>
          <em>+{formatNum(n)}</em>
        </span>
      ))}
    </p>
  )
}

const CATEGORIES: { id: HabitCategory; label: string }[] = [
  { id: 'mining', label: 'Mining' },
  { id: 'smelting', label: 'Smelting' },
  { id: 'assembly', label: 'Assembly' },
  { id: 'logistics', label: 'Logistics' },
]

export function HabitsPanel({ highlightHabit = false }: { highlightHabit?: boolean }) {
  const { state, completeHabit, addHabit, removeHabit } = useGame()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<HabitCategory>('logistics')
  const done = state.habits.filter((h) => h.completedToday).length
  const firstOpen = state.habits.find((h) => !h.completedToday)
  const allDone = state.habits.length > 0 && done === state.habits.length

  function onAdd(e: FormEvent) {
    e.preventDefault()
    addHabit(title, category)
    setTitle('')
  }

  function onRemove(id: string, name: string) {
    if (!window.confirm(`Remove task "${name}"?`)) return
    removeHabit(id)
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Daily Tasks</h2>
        <p>
          Check off daily tasks to restock the foundry - ore, plates, belts, inserters -
          so you can expand the factory.
        </p>
        <p className="panel-stat">
          Today {done}/{state.habits.length} · Lifetime {state.totalHabitsCompleted}
        </p>
      </div>

      {state.habits.length === 0 ? (
        <p className="habit-empty">
          No daily tasks on the belt - add one below to restock coal and parts.
        </p>
      ) : allDone ? (
        <p className="habit-empty is-done">
          All tasks stamped today. Come back tomorrow, or add another shift.
        </p>
      ) : null}

      <ul className="habit-list">
        {state.habits.map((habit) => {
          const reward = HABIT_REWARDS[habit.category]
          const pulse = highlightHabit && firstOpen?.id === habit.id
          return (
            <li
              key={habit.id}
              className={`habit ${habit.completedToday ? 'is-done' : ''} ${
                pulse ? 'is-tutorial-pulse' : ''
              }`}
            >
              <button
                type="button"
                className={`habit-check ${pulse ? 'is-tutorial-cta' : ''}`}
                disabled={habit.completedToday}
                onClick={() => completeHabit(habit.id)}
                aria-label={`Complete ${habit.title}`}
              >
                <span className="check-box" />
              </button>
              <div className="habit-body">
                <div className="habit-title-row">
                  <span className="habit-title">{habit.title}</span>
                  <span className={`chip chip-${habit.category}`}>{habit.category}</span>
                </div>
                <p className="habit-meta">
                  Streak {habit.streak} · +{reward.xp} XP
                  {habit.completedToday ? ' · stamped' : ''}
                </p>
                <RewardIcons items={reward.items} />
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onRemove(habit.id, habit.title)}
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
          placeholder="New habit on the belt..."
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
