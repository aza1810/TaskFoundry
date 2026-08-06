import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  addHabit as addHabitLogic,
  clearToast as clearToastLogic,
  clearOfflineReport as clearOfflineReportLogic,
  clearSkillGains as clearSkillGainsLogic,
  collectChest as collectChestLogic,
  completeHabit as completeHabitLogic,
  craftRecipe as craftRecipeLogic,
  cancelCraft as cancelCraftLogic,
  buildStarterLine as buildStarterLineLogic,
  researchTech as researchTechLogic,
  fuelAllDrills as fuelAllDrillsLogic,
  fuelDrillAt as fuelDrillAtLogic,
  importHealthSteps as importHealthStepsLogic,
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
  setFocusSkill as setFocusSkillLogic,
  claimContract as claimContractLogic,
  advanceTutorial as advanceTutorialLogic,
  skipTutorial as skipTutorialLogic,
  quickStartTutorial as quickStartTutorialLogic,
  tickState,
} from './logic'
import type { Dir, GameState, HabitCategory, Placeable, SkillId, TechId } from './types'
import {
  bumpLocalSavedAt,
  loadCloudSession,
  pushCloudSave,
  resolveCloudHydration,
  type CloudSyncStatus,
} from '../cloud/saveSync'

type Action =
  | { type: 'TICK'; now: number }
  | { type: 'SELECT'; tool: GameState['selected'] }
  | { type: 'ROTATE_DIR' }
  | { type: 'PLACE'; x: number; y: number }
  | { type: 'ROTATE_AT'; x: number; y: number }
  | { type: 'COLLECT'; x: number; y: number }
  | { type: 'LOG_STEPS'; amount: number }
  | { type: 'IMPORT_HEALTH_STEPS'; healthStepsToday: number; quiet?: boolean }
  | { type: 'COMPLETE_HABIT'; id: string }
  | { type: 'ADD_HABIT'; title: string; category: HabitCategory }
  | { type: 'REMOVE_HABIT'; id: string }
  | { type: 'CRAFT'; recipeId: string }
  | { type: 'CANCEL_CRAFT'; jobId: string }
  | { type: 'RESEARCH'; id: TechId }
  | { type: 'STARTER' }
  | { type: 'FUEL' }
  | { type: 'FUEL_AT'; x: number; y: number }
  | { type: 'CLEAR_TOAST' }
  | { type: 'CLEAR_OFFLINE_REPORT' }
  | { type: 'CLEAR_SKILL_GAINS' }
  | { type: 'RESET' }
  | { type: 'RENAME'; name: string }
  | { type: 'FOCUS'; id: SkillId }
  | { type: 'CLAIM_CONTRACT'; id: string }
  | { type: 'ADVANCE_TUTORIAL' }
  | { type: 'SKIP_TUTORIAL' }
  | { type: 'QUICK_START_TUTORIAL' }
  | { type: 'HYDRATE'; state: GameState }

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
    case 'IMPORT_HEALTH_STEPS':
      return importHealthStepsLogic(state, action.healthStepsToday, {
        quiet: action.quiet,
      })
    case 'COMPLETE_HABIT':
      return completeHabitLogic(state, action.id)
    case 'ADD_HABIT':
      return addHabitLogic(state, action.title, action.category)
    case 'REMOVE_HABIT':
      return removeHabitLogic(state, action.id)
    case 'CRAFT':
      return craftRecipeLogic(state, action.recipeId)
    case 'CANCEL_CRAFT':
      return cancelCraftLogic(state, action.jobId)
    case 'RESEARCH':
      return researchTechLogic(state, action.id)
    case 'STARTER':
      return buildStarterLineLogic(state)
    case 'FUEL':
      return fuelAllDrillsLogic(state)
    case 'FUEL_AT':
      return fuelDrillAtLogic(state, action.x, action.y)
    case 'CLEAR_TOAST':
      return clearToastLogic(state)
    case 'CLEAR_OFFLINE_REPORT':
      return clearOfflineReportLogic(state)
    case 'CLEAR_SKILL_GAINS':
      return clearSkillGainsLogic(state)
    case 'RESET':
      return resetGame()
    case 'RENAME':
      return renamePlayer(state, action.name)
    case 'FOCUS':
      return setFocusSkillLogic(state, action.id)
    case 'CLAIM_CONTRACT':
      return claimContractLogic(state, action.id)
    case 'ADVANCE_TUTORIAL':
      return advanceTutorialLogic(state)
    case 'SKIP_TUTORIAL':
      return skipTutorialLogic(state)
    case 'QUICK_START_TUTORIAL':
      return quickStartTutorialLogic(state)
    case 'HYDRATE':
      return action.state
    default:
      return state
  }
}

interface GameContextValue {
  state: GameState
  cloudSync: CloudSyncStatus
  selectTool: (tool: GameState['selected']) => void
  rotateDir: () => void
  place: (x: number, y: number) => void
  rotateAt: (x: number, y: number) => void
  collect: (x: number, y: number) => void
  logSteps: (amount: number) => void
  importHealthSteps: (healthStepsToday: number, options?: { quiet?: boolean }) => void
  completeHabit: (id: string) => void
  addHabit: (title: string, category: HabitCategory) => void
  removeHabit: (id: string) => void
  craft: (recipeId: string) => void
  cancelCraft: (jobId: string) => void
  research: (id: TechId) => void
  buildStarter: () => void
  fuelDrills: () => void
  fuelAt: (x: number, y: number) => void
  clearToast: () => void
  clearOfflineReport: () => void
  reset: () => void
  rename: (name: string) => void
  toggleFocus: (id: SkillId) => void
  claimContract: (id: string) => void
  advanceTutorial: () => void
  skipTutorial: () => void
  quickStartTutorial: () => void
  placeDir: Dir
  selected: GameState['selected']
}

const GameContext = createContext<GameContextValue | null>(null)

export function GameProvider({
  children,
  saveKey,
  displayName,
  enableCloudSync = false,
}: {
  children: ReactNode
  saveKey: string
  displayName?: string
  enableCloudSync?: boolean
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const loaded = loadState(saveKey)
    if (displayName && loaded.playerName === 'Operator') {
      return { ...loaded, playerName: displayName }
    }
    return loaded
  })
  const [cloudSync, setCloudSync] = useState<CloudSyncStatus>(() =>
    enableCloudSync
      ? loadCloudSession()
        ? 'syncing'
        : 'error'
      : 'local-only',
  )
  const saveTimer = useRef<number | null>(null)
  const cloudTimer = useRef<number | null>(null)
  const cloudReady = useRef(!enableCloudSync)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!enableCloudSync) {
      setCloudSync('local-only')
      cloudReady.current = true
      return
    }
    if (!loadCloudSession()) {
      setCloudSync('error')
      cloudReady.current = true
      return
    }

    let cancelled = false
    setCloudSync('syncing')
    void (async () => {
      const result = await resolveCloudHydration(saveKey, stateRef.current)
      if (cancelled) return
      if (result?.fromCloud) {
        const { offlineReport: _o, ...persisted } = result.state
        localStorage.setItem(saveKey, JSON.stringify(persisted))
        const next = loadState(saveKey)
        dispatch({
          type: 'HYDRATE',
          state:
            displayName && next.playerName === 'Operator'
              ? { ...next, playerName: displayName }
              : next,
        })
      }
      cloudReady.current = true
      setCloudSync(loadCloudSession() ? 'synced' : 'error')
    })()

    return () => {
      cancelled = true
    }
  }, [enableCloudSync, saveKey, displayName])

  useEffect(() => {
    // Catch up immediately on mount, then on a short interval.
    dispatch({ type: 'TICK', now: Date.now() })
    const id = window.setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() })
    }, 200)
    return () => window.clearInterval(id)
  }, [])

  // Catch up immediately when returning to the tab (browsers throttle timers in background).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        dispatch({ type: 'TICK', now: Date.now() })
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveState(state)
      const savedAt = bumpLocalSavedAt(saveKey)
      if (!enableCloudSync || !cloudReady.current || !loadCloudSession()) return
      if (cloudTimer.current) window.clearTimeout(cloudTimer.current)
      cloudTimer.current = window.setTimeout(() => {
        setCloudSync('syncing')
        void pushCloudSave(saveKey, stateRef.current, savedAt)
          .then(() => setCloudSync('synced'))
          .catch(() => setCloudSync(loadCloudSession() ? 'offline' : 'error'))
      }, 2500)
    }, 400)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      if (cloudTimer.current) window.clearTimeout(cloudTimer.current)
    }
  }, [state, saveKey, enableCloudSync])

  useEffect(() => {
    if (!enableCloudSync) return
    function flush() {
      if (!cloudReady.current || !loadCloudSession()) return
      const savedAt = bumpLocalSavedAt(saveKey)
      saveState(stateRef.current)
      void pushCloudSave(saveKey, stateRef.current, savedAt).catch(() => {
        /* best-effort on hide */
      })
    }
    function onVisibility() {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enableCloudSync, saveKey])

  useEffect(() => {
    if (!state.unlockedToast) return
    const id = window.setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3200)
    return () => window.clearTimeout(id)
  }, [state.unlockedToast])

  useEffect(() => {
    if (!state.lastSkillGains) return
    const id = window.setTimeout(
      () => dispatch({ type: 'CLEAR_SKILL_GAINS' }),
      1600,
    )
    return () => window.clearTimeout(id)
  }, [state.lastSkillGains])

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
      if (key === '6') dispatch({ type: 'SELECT', tool: 'assembler' })
      if (key === 'c') dispatch({ type: 'SELECT', tool: 'copy' })
      if (key === 'v') dispatch({ type: 'SELECT', tool: 'paste' })
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
  const importHealthSteps = useCallback(
    (healthStepsToday: number, options?: { quiet?: boolean }) =>
      dispatch({
        type: 'IMPORT_HEALTH_STEPS',
        healthStepsToday,
        quiet: options?.quiet,
      }),
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
  const cancelCraft = useCallback(
    (jobId: string) => dispatch({ type: 'CANCEL_CRAFT', jobId }),
    [],
  )
  const research = useCallback(
    (id: TechId) => dispatch({ type: 'RESEARCH', id }),
    [],
  )
  const buildStarter = useCallback(() => dispatch({ type: 'STARTER' }), [])
  const fuelDrills = useCallback(() => dispatch({ type: 'FUEL' }), [])
  const fuelAt = useCallback(
    (x: number, y: number) => dispatch({ type: 'FUEL_AT', x, y }),
    [],
  )
  const clearToast = useCallback(() => dispatch({ type: 'CLEAR_TOAST' }), [])
  const clearOfflineReport = useCallback(
    () => dispatch({ type: 'CLEAR_OFFLINE_REPORT' }),
    [],
  )
  const reset = useCallback(() => {
    if (window.confirm('Scrap the factory and start over?')) dispatch({ type: 'RESET' })
  }, [])
  const rename = useCallback(
    (name: string) => dispatch({ type: 'RENAME', name }),
    [],
  )
  const toggleFocus = useCallback(
    (id: SkillId) => dispatch({ type: 'FOCUS', id }),
    [],
  )
  const claimContract = useCallback(
    (id: string) => dispatch({ type: 'CLAIM_CONTRACT', id }),
    [],
  )
  const advanceTutorial = useCallback(() => dispatch({ type: 'ADVANCE_TUTORIAL' }), [])
  const skipTutorial = useCallback(() => dispatch({ type: 'SKIP_TUTORIAL' }), [])
  const quickStartTutorial = useCallback(
    () => dispatch({ type: 'QUICK_START_TUTORIAL' }),
    [],
  )

  const value = useMemo(
    () => ({
      state,
      cloudSync,
      selectTool,
      rotateDir,
      place,
      rotateAt,
      collect,
      logSteps,
      importHealthSteps,
      completeHabit,
      addHabit,
      removeHabit,
      craft,
      cancelCraft,
      research,
      buildStarter,
      fuelDrills,
      fuelAt,
      clearToast,
      clearOfflineReport,
      reset,
      rename,
      toggleFocus,
      claimContract,
      advanceTutorial,
      skipTutorial,
      quickStartTutorial,
      placeDir: state.placeDir,
      selected: state.selected,
    }),
    [
      state,
      cloudSync,
      selectTool,
      rotateDir,
      place,
      rotateAt,
      collect,
      logSteps,
      importHealthSteps,
      completeHabit,
      addHabit,
      removeHabit,
      craft,
      cancelCraft,
      research,
      buildStarter,
      fuelDrills,
      fuelAt,
      clearToast,
      clearOfflineReport,
      reset,
      rename,
      toggleFocus,
      claimContract,
      advanceTutorial,
      skipTutorial,
      quickStartTutorial,
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
