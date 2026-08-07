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
import {
  applyImportedSave,
  exportSavePayload,
  parseImportedSave,
} from '../cloud/localTransfer'

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
  pullCloudSaveNow: () => Promise<string | null>
  exportSaveFile: () => void
  importSaveFile: (file: File) => Promise<string | null>
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
  // True only after a successful cloud pull/push decision (or local-only mode).
  // Prevents empty web tabs from bumping savedAt and overwriting phone saves.
  const [cloudBootDone, setCloudBootDone] = useState(!enableCloudSync)
  const saveTimer = useRef<number | null>(null)
  const cloudTimer = useRef<number | null>(null)
  const cloudReady = useRef(!enableCloudSync)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (!enableCloudSync) {
      setCloudSync('local-only')
      cloudReady.current = true
      setCloudBootDone(true)
      return
    }
    if (!loadCloudSession()) {
      setCloudSync('error')
      // Do not mark ready for pushes - local play stays device-only until
      // the operator signs in with Google again and creates a cloud session.
      cloudReady.current = false
      setCloudBootDone(true)
      return
    }

    let cancelled = false

    async function hydrateFromCloud() {
      cloudReady.current = false
      setCloudSync('syncing')
      const result = await resolveCloudHydration(saveKey, stateRef.current)
      if (cancelled) return
      if (!result.ok) {
        cloudReady.current = false
        setCloudBootDone(true)
        setCloudSync(result.reason === 'no-session' ? 'error' : 'offline')
        return
      }
      if (result.fromCloud) {
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
      setCloudBootDone(true)
      setCloudSync(loadCloudSession() ? 'synced' : 'error')
    }

    setCloudBootDone(false)
    void hydrateFromCloud()

    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (cancelled || cloudReady.current) return
      if (!loadCloudSession()) return
      void hydrateFromCloud()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enableCloudSync, saveKey, displayName])

  useEffect(() => {
    // Wait for cloud hydration so we tick the restored foundry, not an empty local stub.
    if (enableCloudSync && !cloudBootDone) return
    dispatch({ type: 'TICK', now: Date.now() })
    const id = window.setInterval(() => {
      dispatch({ type: 'TICK', now: Date.now() })
    }, 200)
    return () => window.clearInterval(id)
  }, [enableCloudSync, cloudBootDone])

  // Catch up immediately when returning to the tab (browsers throttle timers in background).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      if (enableCloudSync && !cloudReady.current) return
      dispatch({ type: 'TICK', now: Date.now() })
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [enableCloudSync])

  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      // Always persist locally; only bump sync timestamps after cloud boot.
      saveState(state)
      if (enableCloudSync && !cloudReady.current) return
      const savedAt = bumpLocalSavedAt(saveKey)
      if (!enableCloudSync || !loadCloudSession()) return
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
  }, [state, saveKey, enableCloudSync, cloudBootDone])

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

  const hydrateLoaded = useCallback(
    (nextState: GameState) => {
      const { offlineReport: _o, ...persisted } = nextState
      localStorage.setItem(saveKey, JSON.stringify(persisted))
      const next = loadState(saveKey)
      dispatch({
        type: 'HYDRATE',
        state:
          displayName && next.playerName === 'Operator'
            ? { ...next, playerName: displayName }
            : next,
      })
    },
    [saveKey, displayName],
  )

  const pullCloudSaveNow = useCallback(async () => {
    if (!enableCloudSync) return 'Cloud sync is only for Google Sign-In'
    if (!loadCloudSession()) {
      return 'Cloud sync needs a fresh Google sign-in. Sign out, then Continue with Google.'
    }
    setCloudSync('syncing')
    cloudReady.current = false
    const result = await resolveCloudHydration(saveKey, stateRef.current)
    if (!result.ok) {
      cloudReady.current = false
      setCloudSync(result.reason === 'no-session' ? 'error' : 'offline')
      return result.reason === 'no-session'
        ? 'Cloud session missing. Sign out and Continue with Google.'
        : 'Could not reach cloud save. Try again when you are online.'
    }
    if (result.fromCloud) {
      hydrateLoaded(result.state)
    } else if (loadCloudSession()) {
      const savedAt = bumpLocalSavedAt(saveKey)
      try {
        await pushCloudSave(saveKey, stateRef.current, savedAt)
      } catch {
        cloudReady.current = true
        setCloudSync('offline')
        return 'Kept this device save, but cloud upload failed.'
      }
    }
    cloudReady.current = true
    setCloudBootDone(true)
    setCloudSync('synced')
    return null
  }, [enableCloudSync, saveKey, hydrateLoaded])

  const exportSaveFile = useCallback(() => {
    const blob = new Blob([exportSavePayload(stateRef.current)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task-foundry-save-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const importSaveFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const imported = parseImportedSave(text)
        applyImportedSave(saveKey, imported)
        hydrateLoaded(imported)
        if (enableCloudSync && loadCloudSession()) {
          const savedAt = bumpLocalSavedAt(saveKey)
          cloudReady.current = true
          setCloudBootDone(true)
          setCloudSync('syncing')
          try {
            await pushCloudSave(saveKey, imported, savedAt)
            setCloudSync('synced')
          } catch {
            setCloudSync('offline')
            return 'Save imported on this device, but cloud upload failed.'
          }
        }
        return null
      } catch (err) {
        return err instanceof Error ? err.message : 'Could not import save'
      }
    },
    [saveKey, hydrateLoaded, enableCloudSync],
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
      pullCloudSaveNow,
      exportSaveFile,
      importSaveFile,
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
      pullCloudSaveNow,
      exportSaveFile,
      importSaveFile,
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
