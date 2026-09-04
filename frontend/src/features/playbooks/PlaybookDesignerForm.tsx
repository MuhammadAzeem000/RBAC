import '@xyflow/react/dist/style.css'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import type { Connection, Edge, EdgeProps, Node, NodeProps, OnConnect } from '@xyflow/react'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { connectorsApi } from '@/api/connectors.api'
import { policiesApi } from '@/api/policies.api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/cn'
import type { Connector } from '@/types/connector'
import type {
  ConditionOperator,
  CreatePlaybookInput,
  PlaybookDetail,
  PlaybookEdge,
  PlaybookStep,
  Policy,
  SavePlaybookInput,
  StepCondition,
} from '@/types/playbook'
import { layoutFromSteps, synthesizeLinearEdges, validateGraphStructure } from './graphUtils'

// A playbook's key is a stable identifier (used in URLs and by every
// PlaybookRun that ever started from it) — same slug pattern as
// backend/services/playbook-service/src/interfaces/playbook.ts's keySchema.
const keyPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/

const detailsSchema = z.object({
  key: z.string().trim().toLowerCase().min(2).max(100).regex(keyPattern, 'lowercase, dash-separated'),
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  startPolicyKey: z.string(),
})
type DetailsFormValues = z.infer<typeof detailsSchema>

export interface PlaybookFormValues extends DetailsFormValues {
  steps: PlaybookStep[]
  edges: PlaybookEdge[]
}

function toDetailsValues(playbook?: PlaybookDetail): DetailsFormValues {
  if (!playbook) return { key: '', name: '', description: '', startPolicyKey: '' }
  return {
    key: playbook.key,
    name: playbook.name,
    description: playbook.description ?? '',
    startPolicyKey: playbook.startPolicyKey ?? '',
  }
}

export function toSaveInput(values: PlaybookFormValues): SavePlaybookInput {
  return {
    name: values.name,
    description: values.description || undefined,
    startPolicyKey: values.startPolicyKey || undefined,
    steps: values.steps,
    edges: values.edges,
  }
}

export function toCreateInput(values: PlaybookFormValues): CreatePlaybookInput {
  return { ...toSaveInput(values), key: values.key }
}

// --- React Flow node/edge data shapes -------------------------------------
// A node's React Flow `id` is a stable, internally-generated identifier
// decoupled from the editable step `key` field — renaming a step's key in
// the side panel would otherwise require rewiring every edge pointing at
// it. Edges are translated from flow-id-based connections to key-based
// PlaybookEdges only at submit time (buildSaveGraph below).
interface StepNodeData extends Record<string, unknown> {
  key: string
  name: string
  connector: string
  action: string
  policyKey: string
  configText: string
}
type StepFlowNode = Node<StepNodeData, 'step'>

interface ConditionEdgeData extends Record<string, unknown> {
  condition?: StepCondition
}
type ConditionFlowEdge = Edge<ConditionEdgeData, 'condition'>

const CONDITION_OPERATORS: ConditionOperator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists']

function coerceConditionValue(raw: string): unknown {
  if (raw.trim() === '') return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function buildInitialGraph(playbook?: PlaybookDetail): { nodes: StepFlowNode[]; edges: ConditionFlowEdge[] } {
  if (!playbook || playbook.steps.length === 0) {
    return {
      nodes: [
        {
          id: crypto.randomUUID(),
          type: 'step',
          position: { x: 80, y: 80 },
          data: { key: '', name: '', connector: '', action: '', policyKey: '', configText: '{}' },
        },
      ],
      edges: [],
    }
  }

  const positions = layoutFromSteps(playbook.steps, playbook.edges)
  const keyToId = new Map(playbook.steps.map((step) => [step.key, crypto.randomUUID()]))
  const nodes: StepFlowNode[] = playbook.steps.map((step) => ({
    id: keyToId.get(step.key)!,
    type: 'step',
    position: step.position ?? positions[step.key] ?? { x: 80, y: 80 },
    data: {
      key: step.key,
      name: step.name,
      connector: step.connector ?? '',
      action: step.action ?? '',
      policyKey: step.policyKey ?? '',
      configText: JSON.stringify(step.config, null, 2),
    },
  }))

  const effectiveEdges = playbook.edges.length > 0 ? playbook.edges : synthesizeLinearEdges(playbook.steps)
  const edges: ConditionFlowEdge[] = effectiveEdges.map((edge) => ({
    id: edge.id,
    type: 'condition',
    source: keyToId.get(edge.source) ?? edge.source,
    target: keyToId.get(edge.target) ?? edge.target,
    data: { condition: edge.condition },
  }))

  return { nodes, edges }
}

// Converts the canvas's current node/edge state into the key-based shape
// the backend actually stores, and reports the first validation problem
// found (missing fields, invalid JSON, duplicate keys, or a structural
// graph error — see graphUtils.ts's validateGraphStructure, the same rules
// backend/services/playbook-service/src/utils/playbookGraph.ts enforces).
function buildSaveGraph(nodes: StepFlowNode[], edges: ConditionFlowEdge[]): { steps: PlaybookStep[]; edges: PlaybookEdge[] } | { error: string } {
  const seenKeys = new Set<string>()
  const steps: PlaybookStep[] = []

  for (const node of nodes) {
    const key = node.data.key.trim()
    const name = node.data.name.trim()
    if (!key) return { error: 'Every step needs a key.' }
    if (!name) return { error: `Step "${key}" needs a name.` }
    if (seenKeys.has(key)) return { error: `Duplicate step key "${key}".` }
    seenKeys.add(key)

    let config: Record<string, unknown> = {}
    if (node.data.configText.trim()) {
      try {
        config = JSON.parse(node.data.configText)
      } catch {
        return { error: `Step "${name}" has invalid JSON params.` }
      }
    }

    steps.push({
      key,
      name,
      connector: node.data.connector || undefined,
      action: node.data.action || undefined,
      policyKey: node.data.policyKey || undefined,
      config,
      position: node.position,
    })
  }

  const idToKey = new Map(nodes.map((node) => [node.id, node.data.key.trim()]))
  const playbookEdges: PlaybookEdge[] = edges.map((edge) => {
    const condition = edge.data?.condition
    return {
      id: edge.id,
      source: idToKey.get(edge.source) ?? edge.source,
      target: idToKey.get(edge.target) ?? edge.target,
      condition: condition?.field.trim()
        ? { field: condition.field.trim(), operator: condition.operator, value: condition.value }
        : undefined,
    }
  })

  const structureError = validateGraphStructure(steps, playbookEdges)
  if (structureError) return { error: structureError }

  return { steps, edges: playbookEdges }
}

// --- Custom node/edge renderers --------------------------------------------

function StepNode({ data, selected }: NodeProps<StepFlowNode>) {
  const hasConnector = Boolean(data.connector)
  return (
    <div
      className={cn(
        'w-56 rounded-lg border bg-white px-3 py-2 shadow-sm',
        selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200',
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !border-slate-400 !bg-white" />
      <p className="truncate text-sm font-semibold text-slate-900">{data.name || 'Untitled step'}</p>
      <p className="truncate font-mono text-[11px] text-slate-400">{data.key || '(no key)'}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {hasConnector ? (
          <Badge tone="blue">
            {data.connector}
            {data.action ? `.${data.action}` : ''}
          </Badge>
        ) : (
          <Badge tone="slate">Simulated</Badge>
        )}
        {data.policyKey && (
          <Badge tone="amber">
            <ShieldCheck className="mr-0.5 inline size-3" aria-hidden="true" />
            Approval
          </Badge>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!size-2 !border-slate-400 !bg-white" />
    </div>
  )
}

function ConditionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<ConditionFlowEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const condition = data?.condition
  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {condition && (
        <EdgeLabelRenderer>
          <div
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            className="pointer-events-none absolute rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow ring-1 ring-slate-200"
          >
            {condition.field} {condition.operator}
            {condition.value !== undefined ? ` ${JSON.stringify(condition.value)}` : ''}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const nodeTypes = { step: StepNode }
const edgeTypes = { condition: ConditionEdge }

// --- Side panel --------------------------------------------------------

function NodePanel({
  node,
  connectors,
  policies,
  canDelete,
  onChange,
  onDelete,
}: {
  node: StepFlowNode
  connectors: Connector[]
  policies: Policy[]
  canDelete: boolean
  onChange: (patch: Partial<StepNodeData>) => void
  onDelete: () => void
}) {
  const selectedConnector = connectors.find((c) => c.key === node.data.connector)

  return (
    <div className="flex h-full flex-col gap-3">
      <FormField label="Step key" required>
        {(id) => <Input id={id} value={node.data.key} onChange={(e) => onChange({ key: e.target.value })} />}
      </FormField>
      <FormField label="Step name" required>
        {(id) => <Input id={id} value={node.data.name} onChange={(e) => onChange({ name: e.target.value })} />}
      </FormField>
      <FormField label="Connector" hint="Leave unset to simulate this step.">
        {(id) => (
          <Select
            id={id}
            value={node.data.connector}
            onChange={(e) => onChange({ connector: e.target.value, action: '' })}
          >
            <option value="">Simulated (no connector)</option>
            {connectors.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Action">
        {(id) => (
          <Select id={id} disabled={!selectedConnector} value={node.data.action} onChange={(e) => onChange({ action: e.target.value })}>
            <option value="">Select an action…</option>
            {(selectedConnector?.actionKeys ?? []).map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Approval gate" hint="Pauses for human approval before this step runs.">
        {(id) => (
          <Select id={id} value={node.data.policyKey} onChange={(e) => onChange({ policyKey: e.target.value })}>
            <option value="">None</option>
            {policies.map((policy) => (
              <option key={policy.key} value={policy.key}>
                {policy.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Params (JSON)" hint='e.g. {"channel": "#soc-alerts", "text": "..."}'>
        {(id) => (
          <Textarea
            id={id}
            rows={5}
            className="font-mono text-xs"
            value={node.data.configText}
            onChange={(e) => onChange({ configText: e.target.value })}
          />
        )}
      </FormField>
      <Button type="button" variant="danger-ghost" disabled={!canDelete} onClick={onDelete}>
        <Trash2 className="size-3.5" aria-hidden="true" />
        Delete step
      </Button>
    </div>
  )
}

function EdgePanel({
  edge,
  onChangeCondition,
  onDelete,
}: {
  edge: ConditionFlowEdge
  onChangeCondition: (condition: StepCondition | undefined) => void
  onDelete: () => void
}) {
  const condition = edge.data?.condition
  const conditionId = useId()

  return (
    <div className="flex h-full flex-col gap-3">
      <p className="text-xs text-slate-500">
        This connection runs unconditionally unless you add a condition below — useful both for a plain sequence and
        for a parallel fan-out (two unconditioned connections from the same step).
      </p>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-700" htmlFor={conditionId}>
        <Checkbox
          id={conditionId}
          checked={Boolean(condition)}
          onChange={(e) => onChangeCondition(e.target.checked ? { field: '', operator: 'eq', value: '' } : undefined)}
        />
        Guard this path with a condition
      </label>
      {condition && (
        <>
          <FormField label="Field" hint={'Dot-path into a previous step\'s output, e.g. "lookup-ip.stats.malicious".'}>
            {(id) => (
              <Input id={id} value={condition.field} onChange={(e) => onChangeCondition({ ...condition, field: e.target.value })} />
            )}
          </FormField>
          <FormField label="Operator">
            {(id) => (
              <Select
                id={id}
                value={condition.operator}
                onChange={(e) => onChangeCondition({ ...condition, operator: e.target.value as ConditionOperator })}
              >
                {CONDITION_OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          {condition.operator !== 'exists' && (
            <FormField label="Value" hint="Parsed as JSON when possible (numbers/booleans), otherwise a plain string.">
              {(id) => (
                <Input
                  id={id}
                  value={typeof condition.value === 'string' ? condition.value : JSON.stringify(condition.value ?? '')}
                  onChange={(e) => onChangeCondition({ ...condition, value: coerceConditionValue(e.target.value) })}
                />
              )}
            </FormField>
          )}
        </>
      )}
      <Button type="button" variant="danger-ghost" onClick={onDelete}>
        <Trash2 className="size-3.5" aria-hidden="true" />
        Delete connection
      </Button>
    </div>
  )
}

// --- Main component ------------------------------------------------------

interface PlaybookDesignerFormProps {
  formId: string
  defaultValues?: PlaybookDetail
  isEditing: boolean
  onSubmit: (values: PlaybookFormValues) => void
}

export function PlaybookDesignerForm({ formId, defaultValues, isEditing, onSubmit }: PlaybookDesignerFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: toDetailsValues(defaultValues),
  })

  const [nodes, setNodes, onNodesChange] = useNodesState<StepFlowNode>(buildInitialGraph(defaultValues).nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<ConditionFlowEdge>(buildInitialGraph(defaultValues).edges)
  const [graphError, setGraphError] = useState<string | null>(null)

  useEffect(() => {
    if (!defaultValues) return
    reset(toDetailsValues(defaultValues))
    const seeded = buildInitialGraph(defaultValues)
    setNodes(seeded.nodes)
    setEdges(seeded.edges)
    // defaultValues arrives once (react-query resolves the edit-mode fetch)
    // — same "reset when it shows up" pattern the previous list-based form
    // used, just also re-seeding the canvas instead of RHF's steps array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues])

  const connectorsQuery = useQuery({ queryKey: ['connectors'], queryFn: () => connectorsApi.list() })
  const policiesQuery = useQuery({ queryKey: ['policies'], queryFn: () => policiesApi.list() })
  const connectors = connectorsQuery.data ?? []
  const policies = policiesQuery.data ?? []

  const selectedNode = nodes.find((n) => n.selected)
  const selectedEdge = edges.find((e) => e.selected)

  const onConnect: OnConnect = (connection: Connection) => {
    setEdges((eds) => addEdge({ ...connection, id: crypto.randomUUID(), type: 'condition', data: {} }, eds))
  }

  function handleAddStep() {
    const id = crypto.randomUUID()
    const offset = nodes.length
    const position = { x: 80 + (offset % 4) * 260, y: 80 + Math.floor(offset / 4) * 150 }
    setNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      {
        id,
        type: 'step' as const,
        position,
        selected: true,
        data: { key: '', name: '', connector: '', action: '', policyKey: '', configText: '{}' },
      },
    ])
  }

  function updateSelectedNode(patch: Partial<StepNodeData>) {
    if (!selectedNode) return
    setNodes((nds) => nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }

  function deleteSelectedNode() {
    if (!selectedNode) return
    const id = selectedNode.id
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
  }

  function updateSelectedEdgeCondition(condition: StepCondition | undefined) {
    if (!selectedEdge) return
    setEdges((eds) => eds.map((e) => (e.id === selectedEdge.id ? { ...e, data: { condition } } : e)))
  }

  function deleteSelectedEdge() {
    if (!selectedEdge) return
    const id = selectedEdge.id
    setEdges((eds) => eds.filter((e) => e.id !== id))
  }

  function handleNodesDelete(deleted: StepFlowNode[]) {
    const deletedIds = new Set(deleted.map((n) => n.id))
    setEdges((eds) => eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)))
  }

  function handleDetailsValid(details: DetailsFormValues) {
    const graph = buildSaveGraph(nodes, edges)
    if ('error' in graph) {
      setGraphError(graph.error)
      return
    }
    setGraphError(null)
    onSubmit({ ...details, steps: graph.steps, edges: graph.edges })
  }

  return (
    <form id={formId} onSubmit={handleSubmit(handleDetailsValid)} className="flex flex-col gap-4" noValidate>
      <Card>
        <CardHeader>
          <p className="text-sm font-semibold text-slate-900">Details</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              label="Key"
              required
              error={errors.key?.message}
              hint={isEditing ? 'Immutable once created.' : 'Lowercase, dash-separated — e.g. isolate-host.'}
            >
              {(id) => <Input id={id} disabled={isEditing} invalid={Boolean(errors.key)} {...register('key')} />}
            </FormField>
            <FormField label="Name" required error={errors.name?.message}>
              {(id) => <Input id={id} invalid={Boolean(errors.name)} {...register('name')} />}
            </FormField>
          </div>
          <FormField label="Description" error={errors.description?.message}>
            {(id) => <Textarea id={id} rows={2} invalid={Boolean(errors.description)} {...register('description')} />}
          </FormField>
          <FormField
            label="Require approval before this playbook starts"
            hint="Optional — leave unset to run immediately once triggered."
          >
            {(id) => (
              <Select id={id} {...register('startPolicyKey')}>
                <option value="">No approval gate</option>
                {policies.map((policy) => (
                  <option key={policy.key} value={policy.key}>
                    {policy.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Workflow</p>
          <p className="text-xs text-slate-500">
            Drag from a step&rsquo;s bottom handle to another step&rsquo;s top handle to connect them. Select a
            connection to add a condition, or leave multiple unconditioned connections from one step to run them in
            parallel.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={handleAddStep}>
          <Plus className="size-3.5" aria-hidden="true" />
          Add step
        </Button>
      </div>
      {graphError && <p className="text-xs text-red-600">{graphError}</p>}

      <div className="flex overflow-hidden rounded-lg border border-slate-200">
        <div className="h-[560px] flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodesDelete={handleNodesDelete}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
        {(selectedNode || selectedEdge) && (
          <div className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-3">
            {selectedNode && (
              <NodePanel
                node={selectedNode}
                connectors={connectors}
                policies={policies}
                canDelete={nodes.length > 1}
                onChange={updateSelectedNode}
                onDelete={deleteSelectedNode}
              />
            )}
            {!selectedNode && selectedEdge && (
              <EdgePanel edge={selectedEdge} onChangeCondition={updateSelectedEdgeCondition} onDelete={deleteSelectedEdge} />
            )}
          </div>
        )}
      </div>
    </form>
  )
}
