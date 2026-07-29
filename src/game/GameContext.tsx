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
  clearToast as clearToastLogic,
  collectChest as collectChestLogic,
  completeHabit as completeHabitLogic,
  craftRecipe as craftRecipeLogic,
  fuelAllDrills as fuelAllDrillsLogic,
  loadState,
  logSteps as logStepsLogic,
  placeEntity as placeEntityLogic,
  removeHabit as removeHabitLogic,
  renamePlayer,
  resetGame,
  rotateEntityAt as rotateEntityAtLogic,
  rotatePlaceDir as rotatePlaceDirLogic,
  saveState,
  selectTool as selectToolLogic,
  tickState,
} from './logic'
import type { Dir, GameState, HabitCategory, Placeable } from './types'

type Action =
  | { type: 'TICK'; now: number }
  | { type: 'SELECT'; tool: GameState['selected'] }
  | { type: 'ROTATE_DIR' }
  | { type: 'PLACE'; x: number; y: number }
  | { type: 'ROTATE_AT'; x: number; y: number }
  | { type: 'COLLECT'; x: number; y: number }
  | { type: 'LOG_STEPS'; amount: number }
  | { type: 'COMPLETE_HABIT'; id: string }
  | { type: 'ADD_HABIT'; title: string; category: HabitCategory }
  | { type: 'REMOVE_HABIT'; id: string }
  | { type: 'CRAFT'; recipeId: string }
  | { type: 'FUEL' }
  | { type: 'CLEAR_TOAST' }
  | { type: 'RESET' }
  | { type: 'RENAME'; name: string }

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'TICK':
      return tickState(state, action.now)
    case 'SELECT':
      return selectToolLogic(state, action.tool)
    case 'ROTATE_DIR':
      return rotatePlaceDirLogic(state)
    case 'PLACE':
      return placeEntityLogic(state, action.x, action.y)
    case 'ROTATE_AT':
      return rotateEntityAtLogic(state, action.x, action.y)
    case 'COLLECT':
      return collectChestLogic(state, action.x, action.y)
    case 'LOG_STEPS':
      return logStepsLogic(state, action.amount)
    case 'COMPLETE_HABIT':
      return completeHabitLogic(state, action.id)
    case 'ADD_HABIT':
      return addHabitLogic(state, action.title, action.category)
    case 'REMOVE_HABIT':
      return removeHabitLogic(state, action.id)
    case 'CRAFT':
      return craftRecipeLogic(state, action.recipeId)
    case 'FUEL':
      return fuelAllDrillsLogic(state)
    case 'CLEAR_TOAST':
      return clearToastLogic(state)
    case 'RESET':
      return resetGame()
    case 'RENAME':
      return renamePlayer(state, action.name)
    default:
      return state
  }
}

interface GameContextValue {
  state: GameState
  selectTool: (tool: GameState['selected']) => void
  rotateDir: () => void
  place: (x: number, y: number) => void
  rotateAt: (x: number, y: number) => void
  collect: (x: number, y: number) => void
  logSteps: (amount: number) => void
  completeHabit: (id: string) => void
  addHabit: (title: string, category: HabitCategory) => void
  removeHabit: (id: string) => void
  craft: (recipeId: string) => void
  fuelDrills: () => void
  clearToast: () => void
  reset: () => void
  rename: (name: string) => void
  placeDir: Dir
  selected: GameState['selected']
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() })
    }, 200)
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return
      }
      const key = e.key.toLowerCase()
      if (key === 'r') dispatch({ type: 'ROTATE_DIR' })
      if (key === 'q' || key === 'x') dispatch({ type: 'SELECT', tool: 'remove' })
      if (key === '1') dispatch({ type: 'SELECT', tool: 'drill' })
      if (key === '2') dispatch({ type: 'SELECT', tool: 'belt' })
      if (key === '3') dispatch({ type: 'SELECT', tool: 'inserter' })
      if (key === '4') dispatch({ type: 'SELECT', tool: 'furnace' })
      if (key === '5') dispatch({ type: 'SELECT', tool: 'chest' })
      if (key === 'escape') dispatch({ type: 'SELECT', tool: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const selectTool = useCallback(
    (tool: GameState['selected']) => dispatch({ type: 'SELECT', tool }),
    [],
  )
  const rotateDir = useCallback(() => dispatch({ type: 'ROTATE_DIR' }), [])
  const place = useCallback(
    (x: number, y: number) => dispatch({ type: 'PLACE', x, y }),
    [],
  )
  const rotateAt = useCallback(
    (x: number, y: number) => dispatch({ type: 'ROTATE_AT', x, y }),
    [],
  )
  const collect = useCallback(
    (x: number, y: number) => dispatch({ type: 'COLLECT', x, y }),
    [],
  )
  const logSteps = useCallback(
    (amount: number) => dispatch({ type: 'LOG_STEPS', amount }),
    [],
  )
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
  const craft = useCallback(
    (recipeId: string) => dispatch({ type: 'CRAFT', recipeId }),
    [],
  )
  const fuelDrills = useCallback(() => dispatch({ type: 'FUEL' }), [])
  const clearToast = useCallback(() => dispatch({ type: 'CLEAR_TOAST' }), [])
  const reset = useCallback(() => {
    if (window.confirm('Scrap the factory and start over?')) dispatch({ type: 'RESET' })
  }, [])
  const rename = useCallback(
    (name: string) => dispatch({ type: 'RENAME', name }),
    [],
  )

  const value = useMemo(
    () => ({
      state,
      selectTool,
      rotateDir,
      place,
      rotateAt,
      collect,
      logSteps,
      completeHabit,
      addHabit,
      removeHabit,
      craft,
      fuelDrills,
      clearToast,
      reset,
      rename,
      placeDir: state.placeDir,
      selected: state.selected,
    }),
    [
      state,
      selectTool,
      rotateDir,
      place,
      rotateAt,
      collect,
      logSteps,
      completeHabit,
      addHabit,
      removeHabit,
      craft,
      fuelDrills,
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

export type { Placeable }
