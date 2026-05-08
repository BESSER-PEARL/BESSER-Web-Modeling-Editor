import ReactDOM from "react-dom/client"
import { AppWithProvider } from "./App"
import { ReactFlowInstance, type Node, type Edge } from "@xyflow/react"
import {
  parseDiagramType,
  mapFromReactFlowNodeToBesserNode,
  mapFromReactFlowEdgeToBesserEdge,
  filterRenderedElements,
  getSVG,
  getRenderedDiagramBounds,
} from "./utils"
import { UMLDiagramType } from "./types"
import { createDiagramStore, DiagramStore } from "@/store/diagramStore"
import { createMetadataStore, MetadataStore } from "@/store/metadataStore"
import { createPopoverStore, PopoverStore } from "@/store/popoverStore"
import {
  createAssessmentSelectionStore,
  AssessmentSelectionStore,
} from "@/store/assessmentSelectionStore"
import {
  createAlignmentGuidesStore,
  AlignmentGuidesStore,
} from "@/store/alignmentGuidesStore"
import {
  DiagramStoreContext,
  MetadataStoreContext,
  PopoverStoreContext,
  AssessmentSelectionStoreContext,
  AlignmentGuidesStoreContext,
} from "./store/context"
import {
  MessageType,
  SendBroadcastMessage,
  YjsSyncClass,
} from "@/sync/yjsSyncClass"
import * as Y from "yjs"
import { StoreApi } from "zustand"
import * as Besser from "./typings"
import {
  addBesserErrorListener,
  emitBesserError,
  type BesserError,
} from "@/services/errors"

// SA-FIX-Editor PC-12.7: re-export the warning channel from the editor
// barrel so external consumers can `import { BesserError, emitBesserError }`
// from `@besser/wme` without reaching into `services/errors`.
export { emitBesserError, type BesserError }

export class BesserEditor {
  private root: ReactDOM.Root
  private reactFlowInstance: ReactFlowInstance | null = null
  private readonly syncManager: YjsSyncClass
  private readonly ydoc: Y.Doc
  private readonly diagramStore: StoreApi<DiagramStore>
  private readonly metadataStore: StoreApi<MetadataStore>
  private readonly popoverStore: StoreApi<PopoverStore>
  private readonly assessmentSelectionStore: StoreApi<AssessmentSelectionStore>
  private readonly alignmentGuidesStore: StoreApi<AlignmentGuidesStore>
  private subscribers: Besser.Subscribers = {}
  // SA-7a: `ready` resolves once React Flow has initialised (i.e. once
  // `setReactFlowInstance` has been invoked by `<AppWithProvider
  // onReactFlowInit={...} />`). It replaces the v3 `nextRender` getter
  // — a Promise-shaped readiness signal v2 webapp call sites await
  // before reading `editor.model` or interacting with the canvas.
  private readyPromise!: Promise<void>
  private resolveReady!: () => void
  constructor(element: HTMLElement, options?: Besser.BesserOptions) {
    if (!(element instanceof HTMLElement)) {
      throw new Error("Element is required to initialize BesserEditor")
    }

    // SA-7a: prepare the `ready` promise before render. `setReactFlowInstance`
    // resolves it once `<AppWithProvider />` mounts and React Flow signals
    // its `onReactFlowInit` hook.
    this.readyPromise = new Promise<void>((resolve) => {
      this.resolveReady = resolve
    })

    this.ydoc = new Y.Doc()
    this.diagramStore = createDiagramStore(this.ydoc)
    this.metadataStore = createMetadataStore(this.ydoc)
    this.popoverStore = createPopoverStore()
    this.assessmentSelectionStore = createAssessmentSelectionStore()
    this.alignmentGuidesStore = createAlignmentGuidesStore()
    this.syncManager = new YjsSyncClass(
      this.ydoc,
      this.diagramStore,
      this.metadataStore
    )

    const diagramId =
      options?.model?.id || Math.random().toString(36).substring(2, 15)

    // Initialize React root
    this.root = ReactDOM.createRoot(element, {
      identifierPrefix: `besser-${diagramId}`,
    })

    this.diagramStore.getState().setDiagramId(diagramId)

    // Initialize metadata and diagram type
    const diagramName = options?.model?.title || "Untitled Diagram"
    const diagramType =
      options?.type || options?.model?.type || UMLDiagramType.ClassDiagram
    this.metadataStore
      .getState()
      .updateMetaData(diagramName, parseDiagramType(diagramType))

    if (options?.model) {
      const nodes = options.model.nodes || []
      const edges = options.model.edges || []
      const assessments = options.model.assessments || {}
      this.diagramStore.getState().setNodesAndEdges(nodes, edges)
      this.diagramStore.getState().setAssessments(assessments)
      this.diagramStore.getState().setInteractive(options.model.interactive)
    }

    if (options?.mode) {
      this.metadataStore.getState().setMode(options.mode)
    }
    if (options?.view) {
      this.metadataStore.getState().setView(options.view)
    }
    const availableViews = options?.availableViews
      ? Array.from(
          new Set([
            Besser.BesserView.Modelling,
            ...options.availableViews,
            ...(options.view ? [options.view] : []),
          ])
        )
      : options?.view === Besser.BesserView.Highlight
        ? [Besser.BesserView.Modelling, Besser.BesserView.Highlight]
        : undefined
    if (availableViews) {
      this.metadataStore.getState().setAvailableViews(availableViews)
    }
    if (options?.enablePopups !== undefined) {
      this.popoverStore.getState().setPopupEnabled(options.enablePopups)
    }
    if (options?.readonly !== undefined) {
      this.metadataStore.getState().setReadonly(options.readonly)
    }
    if (options?.debug !== undefined) {
      this.metadataStore.getState().setDebug(options.debug)
    }
    if (options?.scrollLock !== undefined) {
      this.metadataStore.getState().setScrollLock(options.scrollLock)
    }

    if (
      this.metadataStore.getState().mode === Besser.BesserMode.Modelling &&
      !options?.collaborationEnabled
    ) {
      this.diagramStore.getState().initializeUndoManager()
    }

    this.root.render(
      <DiagramStoreContext.Provider value={this.diagramStore}>
        <MetadataStoreContext.Provider value={this.metadataStore}>
          <PopoverStoreContext.Provider value={this.popoverStore}>
            <AssessmentSelectionStoreContext.Provider
              value={this.assessmentSelectionStore}
            >
              <AlignmentGuidesStoreContext.Provider
                value={this.alignmentGuidesStore}
              >
                <AppWithProvider
                  onReactFlowInit={this.setReactFlowInstance.bind(this)}
                />
              </AlignmentGuidesStoreContext.Provider>
            </AssessmentSelectionStoreContext.Provider>
          </PopoverStoreContext.Provider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    )
  }

  private setReactFlowInstance(instance: ReactFlowInstance) {
    this.reactFlowInstance = instance
    // SA-7a: resolve the `ready` promise so v2 webapp call sites awaiting
    // `editor.ready` (or its `nextRender` alias) unblock the moment
    // React Flow has produced its instance.
    this.resolveReady?.()
  }

  /**
   * Resolves once React Flow has finished initialising and the editor is
   * safe to interact with (e.g. setting `model`, reading `getNodes()`).
   * Mirrors React Flow's `onInit` semantics in promise form.
   */
  get ready(): Promise<void> {
    return this.readyPromise
  }

  /**
   * @deprecated Use `ready` instead. Alias retained for legacy webapp call sites.
   */
  get nextRender(): Promise<void> {
    return this.ready
  }

  /**
   * @deprecated Use `unsubscribe(id)` instead. Alias retained for legacy webapp call sites.
   */
  unsubscribeFromModelChange(id: number): void {
    return this.unsubscribe(id)
  }

  public getNodes(): Node[] {
    if (this.reactFlowInstance) {
      return this.reactFlowInstance.getNodes()
    }
    return []
  }

  public getEdges(): Edge[] {
    return this.reactFlowInstance ? this.reactFlowInstance.getEdges() : []
  }

  set diagramType(type: UMLDiagramType) {
    this.metadataStore.getState().updateDiagramType(type)
    this.diagramStore.getState().setNodesAndEdges([], [])
    this.diagramStore.getState().setAssessments({})
  }

  public destroy() {
    try {
      // Clean up all active subscriptions before destroying
      Object.keys(this.subscribers).forEach((subscriberId) => {
        const unsubscribeCallback = this.subscribers[parseInt(subscriberId)]
        unsubscribeCallback?.()
      })
      this.subscribers = {}

      this.syncManager.stopSync()
      this.root.unmount()
      this.ydoc.destroy()
      this.reactFlowInstance = null
      // Zustand stores are automatically garbage-collected when references are gone
    } catch {
      // ignore
    }
  }

  /**
   * renders a model as a svg and returns it. Therefore the svg is temporarily added to the dom and removed after it has been rendered.
   *
   * SA-FIX-Editor PC-12.10: the third positional `theme` parameter has
   * been dropped — the BESSER theme is applied via CSS variables on the
   * embedding document (`--besser-*`), so a per-call style override has
   * no path to actually flow into the rendered SVG. Passing one was a
   * silent no-op (`void theme`) and confused integrators. Removing it
   * keeps the type signature honest.
   * @param model the BESSER WME model to export as a svg
   * @param options options to change the export behavior (add margin, exclude element ...)
   */
  static async exportModelAsSvg(
    model: Besser.UMLModel,
    options?: Besser.ExportOptions
  ): Promise<Besser.SVG> {
    const container = document.createElement("div")
    container.style.display = "flex"
    container.style.width = "4000px"
    container.style.height = "4000px"
    container.style.zIndex = "-1000"
    container.style.top = "0"
    container.style.position = "absolute"
    container.style.left = "-99px"

    document.body.appendChild(container)

    const ydoc = new Y.Doc()
    const diagramStore = createDiagramStore(ydoc)
    const metadataStore = createMetadataStore(ydoc)
    const popoverStore = createPopoverStore()
    const assessmentSelectionStore = createAssessmentSelectionStore()
    const alignmentGuidesStore = createAlignmentGuidesStore()
    const diagramId = Math.random().toString(36).substring(2, 15)

    let setReactFlowInstance: (instance: ReactFlowInstance) => void = () => {}

    const reactFlowInstancePromise = new Promise<ReactFlowInstance>(
      (resolve) => {
        setReactFlowInstance = resolve
      }
    )

    const svgRoot = ReactDOM.createRoot(container, {
      identifierPrefix: `besser-exportAsSVG-${diagramId}`,
    })

    diagramStore.getState().setNodesAndEdges(model.nodes, model.edges)
    diagramStore.getState().setAssessments(model.assessments)

    // Render the component
    svgRoot.render(
      <DiagramStoreContext.Provider value={diagramStore}>
        <MetadataStoreContext.Provider value={metadataStore}>
          <PopoverStoreContext.Provider value={popoverStore}>
            <AssessmentSelectionStoreContext.Provider
              value={assessmentSelectionStore}
            >
              <AlignmentGuidesStoreContext.Provider
                value={alignmentGuidesStore}
              >
                <AppWithProvider onReactFlowInit={setReactFlowInstance} />
              </AlignmentGuidesStoreContext.Provider>
            </AssessmentSelectionStoreContext.Provider>
          </PopoverStoreContext.Provider>
        </MetadataStoreContext.Provider>
      </DiagramStoreContext.Provider>
    )

    // Wait for React Flow to initialize
    // Create a timeout promise that resolves to undefined after 3 seconds
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 3000)
    })

    const reactFlowInstance = await Promise.race([
      reactFlowInstancePromise,
      timeoutPromise,
    ])

    if (!reactFlowInstance) {
      document.body.removeChild(container)
      throw new Error("React Flow instance not initialized")
    }

    // Wait for webfonts to load before we measure: canvas text measurement
    // (used by the wrap layout) otherwise falls back to the generic-family
    // metrics and the exported SVG's wrap decisions would drift from the
    // on-screen render. Best-effort — older browsers may lack document.fonts.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready.catch(() => {})
    }

    // Wait for ReactFlow to fully lay out nodes and measure custom handle
    // positions (especially for non-rectangular shapes like parallelograms).
    // setTimeout lets ResizeObserver callbacks fire; double-rAF ensures paint.
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      }, 150)
    })

    filterRenderedElements(container, options)

    const bounds = getRenderedDiagramBounds(reactFlowInstance, container)

    const margin = 60
    const clip = {
      x: bounds.x - margin,
      y: bounds.y - margin,
      width: bounds.width + margin * 2,
      height: bounds.height + margin * 2,
    }

    const svgString = getSVG(container, clip, options)

    // Clean up
    svgRoot.unmount()
    document.body.removeChild(container)
    ydoc.destroy()

    return {
      svg: svgString,
      clip,
    }
  }

  /**
   * exports current model as svg
   * @param options options to change the export behavior (add margin, exclude element ...)
   */
  exportAsSVG(options?: Besser.ExportOptions): Promise<Besser.SVG> {
    return BesserEditor.exportModelAsSvg(this.model, options)
  }

  private getNewSubscriptionId(): number {
    const subscribers = this.subscribers
    // largest key + 1
    if (Object.keys(subscribers).length === 0) return 0
    return Math.max(...Object.keys(subscribers).map((key) => parseInt(key))) + 1
  }

  public subscribeToModelChange(
    callback: (state: Besser.UMLModel) => void
  ): number {
    const subscriberId = this.getNewSubscriptionId()
    const unsubscribeCallback = this.diagramStore.subscribe(() =>
      callback(this.model)
    )
    this.subscribers[subscriberId] = unsubscribeCallback
    return subscriberId
  }

  public subscribeToDiagramNameChange(
    callback: (diagramTitle: string) => void
  ) {
    const subscriberId = this.getNewSubscriptionId()
    const unsubscribeCallback = this.metadataStore.subscribe((state) =>
      callback(state.diagramTitle)
    )
    this.subscribers[subscriberId] = unsubscribeCallback
    return subscriberId
  }

  public subscribeToAssessmentSelection(
    callback: (selectedElementIds: string[]) => void
  ) {
    const subscriberId = this.getNewSubscriptionId()
    const unsubscribeCallback = this.assessmentSelectionStore.subscribe(
      (state) => callback(state.selectedElementIds)
    )
    this.subscribers[subscriberId] = unsubscribeCallback
    return subscriberId
  }

  public unsubscribe(subscriberId: number) {
    const unsubscribeCallback = this.subscribers[subscriberId]
    if (unsubscribeCallback) {
      unsubscribeCallback()
      delete this.subscribers[subscriberId]
    }
  }

  public sendBroadcastMessage(sendFn: SendBroadcastMessage) {
    this.syncManager.setSendBroadcastMessage(sendFn)
  }

  public receiveBroadcastedMessage(base64Data: string) {
    this.syncManager.handleReceivedData(base64Data)
  }

  public updateDiagramTitle(name: string) {
    this.metadataStore.getState().updateDiagramTitle(name)
  }

  public toggleInteractiveElementsMode(forceEnabled?: boolean): void {
    const currentView = this.metadataStore.getState().view
    const shouldEnable =
      forceEnabled ?? currentView !== Besser.BesserView.Highlight

    this.metadataStore
      .getState()
      .setView(
        shouldEnable
          ? Besser.BesserView.Highlight
          : Besser.BesserView.Modelling
      )
  }

  public getInteractiveForSerialization():
    | Besser.InteractiveElements
    | undefined {
    return this.diagramStore.getState().getInteractiveForSerialization()
  }

  public getDiagramMetadata() {
    const { diagramTitle, diagramType } = this.metadataStore.getState()
    return { diagramTitle, diagramType }
  }

  get model(): Besser.UMLModel {
    const { nodes, edges, diagramId } = this.diagramStore.getState()
    const { diagramTitle, diagramType } = this.metadataStore.getState()
    const interactive = this.getInteractiveForSerialization()
    return {
      id: diagramId,
      version: "4.0.0",
      title: diagramTitle,
      type: diagramType,
      nodes: nodes.map((node) => mapFromReactFlowNodeToBesserNode(node)),
      edges: edges.map((edge) => mapFromReactFlowEdgeToBesserEdge(edge)),
      assessments: this.diagramStore.getState().assessments,
      ...(interactive && { interactive }),
    }
  }

  set model(model: Besser.UMLModel) {
    const { nodes, edges, assessments, interactive } = model

    // SA-FIX-Editor PC-12.9: replacing the model wholesale should also
    // discard accumulated undo history — a user shouldn't be able to
    // "undo" past a programmatic model swap into the previous diagram's
    // state. v3 webapp call sites achieved this via the
    // destroy+recreate (`editorRevision++`) hack; clearing the existing
    // `UndoManager` here lets consumers keep the same editor instance.
    const { undoManager } = this.diagramStore.getState()
    undoManager?.clear()

    this.diagramStore.getState().setNodesAndEdges(nodes, edges)
    this.diagramStore.getState().setAssessments(assessments)
    this.diagramStore.getState().setInteractive(interactive)
    this.metadataStore
      .getState()
      .updateMetaData(model.title, parseDiagramType(model.type))
  }

  /**
   * SA-FIX-Editor PC-12.5: replace the canvas selection. Mirrors the v3
   * `editor.select(ids)` API. Filters to known node/edge ids so callers
   * can pass a stale id set without surprising behaviour.
   */
  public select(ids: string[]): void {
    const { nodes, edges, setSelectedElementsId } = this.diagramStore.getState()
    const known = new Set<string>([
      ...nodes.map((n) => n.id),
      ...edges.map((e) => e.id),
    ])
    const filtered = ids.filter((id) => known.has(id))
    setSelectedElementsId(filtered)
  }

  /**
   * SA-FIX-Editor PC-12.6: subscribe to canvas selection changes.
   * Coalesces consecutive selection mutations within the same tick into
   * a single callback (`queueMicrotask` debounces to one tick). Returns
   * a numeric subscriber id compatible with `unsubscribe(id)`, matching
   * the existing `subscribeToModelChange` shape.
   */
  public subscribeToSelectionChange(
    callback: (selectedElementIds: string[]) => void
  ): number {
    const subscriberId = this.getNewSubscriptionId()
    let scheduled = false
    const unsubscribeCallback = this.diagramStore.subscribe((state, prev) => {
      if (state.selectedElementIds === prev.selectedElementIds) return
      if (scheduled) return
      scheduled = true
      queueMicrotask(() => {
        scheduled = false
        callback([...this.diagramStore.getState().selectedElementIds])
      })
    })
    this.subscribers[subscriberId] = unsubscribeCallback
    return subscriberId
  }

  /**
   * SA-FIX-Editor PC-12.7: subscribe to non-fatal warnings emitted from
   * inside the library. Replaces the v3 `subscribeToApollonErrors` after
   * SA-DEBRAND. Returns a numeric id usable with `unsubscribe(id)`.
   */
  public subscribeToBesserErrors(
    callback: (err: BesserError) => void
  ): number {
    const subscriberId = this.getNewSubscriptionId()
    const unsubscribeCallback = addBesserErrorListener(callback)
    this.subscribers[subscriberId] = unsubscribeCallback
    return subscriberId
  }

  /**
   * @deprecated Use `subscribeToBesserErrors` instead. Alias retained
   * so v3 webapp call sites keep type-checking during the SA-DEBRAND
   * transition.
   */
  public subscribeToApollonErrors(
    callback: (err: BesserError) => void
  ): number {
    return this.subscribeToBesserErrors(callback)
  }

  /**
   * SA-FIX-Editor PC-12.7: publish a non-fatal warning. Library callers
   * use this when they reject a malformed model or fall back to a
   * default. Subscribers attached via `subscribeToBesserErrors` receive
   * the payload.
   */
  public emitError(err: BesserError | string): void {
    const payload: BesserError =
      typeof err === "string" ? { message: err } : err
    emitBesserError(payload)
  }

  /**
   * SA-FIX-Editor PC-12.8: external undo. Proxies the Yjs `UndoManager`
   * already wired in `diagramStore`. No-op when collaboration is on
   * (the manager isn't initialised in that path) or the stack is empty.
   */
  public undo(): void {
    this.diagramStore.getState().undo()
  }

  /**
   * SA-FIX-Editor PC-12.8: external redo. See `undo()` above.
   */
  public redo(): void {
    this.diagramStore.getState().redo()
  }

  public getSelectedElements(): string[] {
    const { mode, readonly } = this.metadataStore.getState()
    if (mode === Besser.BesserMode.Assessment && readonly) {
      return this.assessmentSelectionStore.getState().selectedElementIds
    }
    return this.diagramStore.getState().selectedElementIds
  }

  get view(): Besser.BesserView {
    return this.metadataStore.getState().view
  }

  set view(view: Besser.BesserView) {
    this.metadataStore.getState().setView(view)
  }

  public addOrUpdateAssessment(assessment: Besser.Assessment): void {
    this.diagramStore.getState().addOrUpdateAssessment(assessment)
  }

  static generateInitialSyncMessage(): string {
    const syncMessage = new Uint8Array(new Uint8Array([MessageType.YjsSYNC]))
    return YjsSyncClass.uint8ToBase64(syncMessage)
  }
}
