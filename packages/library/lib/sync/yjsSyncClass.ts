import * as Y from "yjs"
import { StoreApi } from "zustand"
import { DiagramStore } from "@/store/diagramStore"
import { MetadataStore } from "@/store/metadataStore"
import {
  getAssessments,
  getDiagramMetadata,
  getEdgesMap,
  getNodesMap,
} from "@/sync/ydoc"
import { Edge, Node } from "@xyflow/react"
import { Assessment } from "@/typings"

export enum MessageType {
  YjsSYNC = 0,
  YjsUpdate = 1,
}

export type SendBroadcastMessage = (base64data: string) => void

export class YjsSyncClass {
  private readonly stopYjsObserver: () => void
  private sendBroadcastMessage: SendBroadcastMessage | null = null
  private readonly ydoc: Y.Doc
  private readonly diagramStore: StoreApi<DiagramStore>
  private readonly metadataStore: StoreApi<MetadataStore>

  constructor(
    ydoc: Y.Doc,
    diagramStore: StoreApi<DiagramStore>,
    metadataStore: StoreApi<MetadataStore>
  ) {
    this.ydoc = ydoc
    this.diagramStore = diagramStore
    this.metadataStore = metadataStore
    this.stopYjsObserver = this.startYjsObserver()
  }

  public stopSync() {
    this.stopYjsObserver()
  }

  public setSendBroadcastMessage = (sendFn: SendBroadcastMessage) => {
    this.sendBroadcastMessage = sendFn
  }

  private applyUpdate = (update: Uint8Array, transactionOrigin: string) => {
    Y.applyUpdate(this.ydoc, update, transactionOrigin)
  }

  public handleReceivedData = (base64Data: string) => {
    // Decode the base64 string to Uint8Array
    const decodedData = this.base64ToUint8(base64Data)
    const messageType = decodedData[0]

    if (messageType === MessageType.YjsUpdate) {
      const update = decodedData.slice(1)
      this.applyUpdate(update, "remote")
    } else if (messageType === MessageType.YjsSYNC) {
      if (this.sendBroadcastMessage) {
        const syncMessage = Y.encodeStateAsUpdate(this.ydoc)
        const fullMessage = new Uint8Array(1 + syncMessage.length)
        fullMessage[0] = MessageType.YjsUpdate
        fullMessage.set(syncMessage, 1)

        const base64Message = YjsSyncClass.uint8ToBase64(fullMessage)
        this.sendBroadcastMessage(base64Message)
      }
    }
  }

  private startYjsObserver = () => {
    const nodesChangeObserver = (
      _event: Y.YMapEvent<Node>,
      transaction: Y.Transaction
    ) => {
      // Don't update from Yjs if the transaction originated from the store
      // or if it's an undo/redo operation
      if (
        transaction.origin !== "store" &&
        !this.isUndoRedoTransaction(transaction)
      ) {
        this.diagramStore.getState().updateNodesFromYjs()
      }
    }

    const edgesObserver = (
      _event: Y.YMapEvent<Edge>,
      transaction: Y.Transaction
    ) => {
      if (
        transaction.origin !== "store" &&
        !this.isUndoRedoTransaction(transaction)
      ) {
        this.diagramStore.getState().updateEdgesFromYjs()
      }
    }

    const metadataObserver = (
      _event: Y.YMapEvent<string>,
      transaction: Y.Transaction
    ) => {
      if (
        transaction.origin !== "store" &&
        !this.isUndoRedoTransaction(transaction)
      ) {
        this.metadataStore.getState().updateMetaDataFromYjs()
      }
    }

    const assessmentObserver = (
      _event: Y.YMapEvent<Assessment>,
      transaction: Y.Transaction
    ) => {
      if (
        transaction.origin !== "store" &&
        !this.isUndoRedoTransaction(transaction)
      ) {
        this.diagramStore.getState().updateAssessmentFromYjs()
      }
    }

    const handleYjsUpdate = (
      _arg0: unknown,
      _arg1: unknown,
      _arg2: Y.Doc,
      transaction: Y.Transaction
    ) => {
      // Send updates for store operations and undo/redo operations
      if (
        this.sendBroadcastMessage &&
        (transaction.origin === "store" ||
          this.isUndoRedoTransaction(transaction))
      ) {
        const syncMessage = Y.encodeStateAsUpdate(this.ydoc)
        const fullMessage = new Uint8Array(1 + syncMessage.length)
        fullMessage[0] = MessageType.YjsUpdate
        fullMessage.set(syncMessage, 1)
        const base64Message = YjsSyncClass.uint8ToBase64(fullMessage)
        this.sendBroadcastMessage(base64Message)
      }

      // Update store state for undo/redo operations
      if (this.isUndoRedoTransaction(transaction)) {
        this.diagramStore.getState().updateNodesFromYjs()
        this.diagramStore.getState().updateEdgesFromYjs()
        this.diagramStore.getState().updateAssessmentFromYjs()
        this.diagramStore.getState().updateUndoRedoState()
      }
    }

    getNodesMap(this.ydoc).observe(nodesChangeObserver)
    getEdgesMap(this.ydoc).observe(edgesObserver)
    getAssessments(this.ydoc).observe(assessmentObserver)
    getDiagramMetadata(this.ydoc).observe(metadataObserver)
    this.ydoc.on("update", handleYjsUpdate)

    return () => {
      getNodesMap(this.ydoc).unobserve(nodesChangeObserver)
      getEdgesMap(this.ydoc).unobserve(edgesObserver)
      getAssessments(this.ydoc).unobserve(assessmentObserver)
      getDiagramMetadata(this.ydoc).unobserve(metadataObserver)
      this.ydoc.off("update", handleYjsUpdate)
    }
  }

  // Helper method to check if a transaction is from undo/redo
  private isUndoRedoTransaction(transaction: Y.Transaction): boolean {
    const undoManager = this.diagramStore.getState().undoManager
    return undoManager ? undoManager === transaction.origin : false
  }

  /**
   *  Convert Uint8Array to Base64 string
   */
  static uint8ToBase64(uint8: Uint8Array): string {
    // For large arrays, process in chunks to avoid stack overflow
    const chunkSize = 8192 // Process 8KB at a time
    let binary = ""

    for (let i = 0; i < uint8.length; i += chunkSize) {
      const chunk = uint8.slice(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }

    return btoa(binary)
  }

  /**
   * Convert Base64 string to Uint8Array
   */
  private base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
}
