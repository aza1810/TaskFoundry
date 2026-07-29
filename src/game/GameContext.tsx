import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import {
  addHabit as addHabitLogic,
  buyBuilding as buyBuildingLogic,
  clearToast as clearToastLogic,
  completeHabit as completeHabitLogic,
  loadState,
  logSteps as logStepsLogic,
  productionRates,
  removeHabit as removeHabitLogic,
  resetGame,
  saveState,
  setAssemblerRecipe,
  setFurnaceRecipe,
  startManualCraft,
  startResearch as startResearchLogic,
  tickState,
} from './logic'
import type {
  BuildingId,
  GameState,
  HabitCategory,
  RecipeId,
  TechId,
} from './types'

type Action =
  | { type: 'TICK'; now: number }
  | { type: 'COMPLETE_HABIT'; id: string }
  | { type: 'ADD_HABIT'; title: string; category: HabitCategory }
  | { type: 'REMOVE_HABIT'; id: string }
  | { type: 'LOG_STEPS'; amount: number }
  | { type: 'CRAFT'; recipeId: RecipeId }
  | { type: 'BUY_BUILDING'; id: BuildingId }
  | { type: 'SET_FURNACE'; recipeId: RecipeId }
  | { type: 'SET_ASSEMBLER'; recipeId: RecipeId | null }
  | { type: 'START_RESEARCH'; id: TechId }
  | { type: 'CLEAR_TOAST' }
  | { type: 'RESET' }
  | { type: 'RENAME'; name: string }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'TICK':
      return tickState(state, action.now)
    case 'COMPLETE_HABIT':
      return completeHabitLogic(state, action.id)
    case 'ADD_HABIT':
      return addHabitLogic(state, action.title, action.category)
    case 'REMOVE_HABIT':
      return removeHabitLogic(state, action.id)
    case 'LOG_STEPS':
      return logStepsLogic(state, action.amount)
    case 'CRAFT':
      return startManualCraft(state, action.recipeId)
    case 'BUY_BUILDING':
      return buyBuildingLogic(state, action.id)
    case 'SET_FURNACE':
      return setFurnaceRecipe(state, action.recipeId)
    case 'SET_ASSEMBLER':
      return setAssemblerRecipe(state, action.recipeId)
    case 'START_RESEARCH':
      return startResearchLogic(state, action.id)
    case 'CLEAR_TOAST':
      return clearToastLogic(state)
    case 'RESET':
      return resetGame()
    case 'RENAME':
      return { ...state, playerName: action.name.slice(0, 24) || state.playerName }
    default:
      return state
  }
}

interface GameContextValue {
  state: GameState
  rates: ReturnType<typeof productionRates>
  completeHabit: (id: string) => void
  addHabit: (title: string, category: HabitCategory) => void
  removeHabit: (id: string) => void
  logSteps: (amount: number) => void
  craft: (recipeId: RecipeId) => void
  buyBuilding: (id: BuildingId) => void
  setFurnace: (recipeId: RecipeId) => void
  setAssembler: (recipeId: RecipeId | null) => void
  startResearch: (id: TechId) => void
  clearToast: () => void
  reset: () => void
  rename: (name: string) => void
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() })
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveState(state), 400)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [state])

  useEffect(() => {
    if (!state.unlockedToast) return
    const id = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3200)
    return () => window.clearTimeout(id)
  }, [state.unlockedToast])

  const completeHabit = useCallback(
    (id: string) => dispatch({ type: 'COMPLETE_HABIT', id }),
    [],
  )
  const addHabit = useCallback(
    (title: string, category: HabitCategory) =>
      dispatch({ type: 'ADD_HABIT', title, category }),
    [],
  )
  const removeHabit = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_HABIT', id }),
    [],
  )
  const logSteps = useCallback(
    (amount: number) => dispatch({ type: 'LOG_STEPS', amount }),
    [],
  )
  const craft = useCallback(
    (recipeId: RecipeId) => dispatch({ type: 'CRAFT', recipeId }),
    [],
  )
  const buyBuilding = useCallback(
    (id: BuildingId) => dispatch({ type: 'BUY_BUILDING', id }),
    [],
  )
  const setFurnace = useCallback(
    (recipeId: RecipeId) => dispatch({ type: 'SET_FURNACE', recipeId }),
    [],
  )
  const setAssembler = useCallback(
    (recipeId: RecipeId | null) => dispatch({ type: 'SET_ASSEMBLER', recipeId }),
    [],
  )
  const startResearch = useCallback(
    (id: TechId) => dispatch({ type: 'START_RESEARCH', id }),
    [],
  )
  const clearToast = useCallback(() => dispatch({ type: 'CLEAR_TOAST' }), [])
  const reset = useCallback(() => {
    if (window.confirm('Scrap the factory and start over?')) dispatch({ type: 'RESET' })
  }, [])
  const rename = useCallback(
    (name: string) => dispatch({ type: 'RENAME', name }),
    [],
  )

  const rates = useMemo(() => productionRates(state), [state])

  const value = useMemo(
    () => ({
      state,
      rates,
      completeHabit,
      addHabit,
      removeHabit,
      logSteps,
      craft,
      buyBuilding,
      setFurnace,
      setAssembler,
      startResearch,
      clearToast,
      reset,
      rename,
    }),
    [
      state,
      rates,
      completeHabit,
      addHabit,
      removeHabit,
      logSteps,
      craft,
      buyBuilding,
      setFurnace,
      setAssembler,
      startResearch,
      clearToast,
      reset,
      rename,
    ],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
