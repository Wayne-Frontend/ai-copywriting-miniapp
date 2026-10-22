<template>
  <div class="space-y-4 pb-4 md:space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <ElButton link type="primary" @click="router.push({ name: 'TemplateList' })">
          <ArtSvgIcon icon="ri:arrow-left-line" class="mr-1" />{{ $t('templateEditor.back') }}
        </ElButton>
        <h1 class="mt-2 text-xl font-semibold text-g-900 md:text-2xl">
          {{ draft?.name ?? code }} · {{ $t('templateEditor.title') }}
        </h1>
        <p class="mt-1 text-sm text-g-600">{{ $t('templateEditor.subtitle') }}</p>
      </div>
      <ElTag v-if="draft" type="info" round>v{{ draft.version }}</ElTag>
    </header>

    <ElAlert
      v-if="loadError"
      type="error"
      :closable="false"
      :title="$t('templateEditor.loadFailed')"
    >
      <ElButton link type="primary" @click="loadDraft">{{ $t('templateEditor.retry') }}</ElButton>
    </ElAlert>

    <template v-if="draft">
      <ElCard class="art-card-sm">
        <div class="mb-5 flex items-center gap-3">
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-theme/10 text-sm font-semibold text-theme"
            >01</span
          >
          <h2 class="text-base font-semibold text-g-900">{{ $t('templateEditor.basic') }}</h2>
        </div>
        <ElForm label-position="top">
          <ElFormItem :label="$t('templateEditor.description')">
            <ElInput
              v-model="form.description"
              type="textarea"
              :rows="2"
              :maxlength="500"
              show-word-limit
            />
          </ElFormItem>
          <ElFormItem :label="$t('templateEditor.prompt')">
            <ElInput
              v-model="form.developerPrompt"
              type="textarea"
              :rows="12"
              :maxlength="10000"
              show-word-limit
            />
          </ElFormItem>
          <ElFormItem :label="$t('templateEditor.changeLog')">
            <ElInput
              v-model="form.changeLog"
              type="textarea"
              :rows="3"
              :maxlength="500"
              show-word-limit
            />
          </ElFormItem>
          <ElFormItem :label="$t('templateEditor.maxTokens')">
            <ElInputNumber v-model="form.maxOutputTokens" :min="128" :max="2048" :step="64" />
          </ElFormItem>
        </ElForm>
      </ElCard>

      <ElCard class="art-card-sm">
        <div class="mb-5 flex items-start gap-3">
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-theme/10 text-sm font-semibold text-theme"
            >02</span
          >
          <div>
            <h2 class="text-base font-semibold text-g-900">{{
              $t('templateEditor.schemaTitle')
            }}</h2>
            <p class="mt-1 text-sm text-g-600">{{ $t('templateEditor.schemaHint') }}</p>
          </div>
        </div>
        <ArtTable :data="fieldRows" row-key="key">
          <ElTableColumn prop="key" :label="$t('templateEditor.fieldKey')" min-width="145" />
          <ElTableColumn :label="$t('templateEditor.fieldLabel')" min-width="180">
            <template #default="{ row }">
              <ElInput
                :model-value="row.label"
                :maxlength="80"
                @update:model-value="updateField(row.key, 'title', $event)"
              />
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('templateEditor.required')" width="90">
            <template #default="{ row }">
              <ElTag :type="row.required ? 'success' : 'info'" size="small">{{
                $t(row.required ? 'templateEditor.yes' : 'templateEditor.no')
              }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn :label="$t('templateEditor.maxLength')" min-width="130">
            <template #default="{ row }">
              <ElInputNumber
                v-if="row.canMax"
                :model-value="row.maxLength"
                :min="row.minLength"
                :max="10000"
                controls-position="right"
                @update:model-value="updateField(row.key, 'maxLength', $event)"
              />
              <span v-else class="text-g-500">—</span>
            </template>
          </ElTableColumn>
        </ArtTable>
        <ElCollapse>
          <ElCollapseItem :title="$t('templateEditor.advancedSchema')" name="advanced">
            <div class="grid gap-5 lg:grid-cols-2">
              <ElFormItem :label="$t('templateEditor.inputSchema')">
                <ElInput
                  v-model="form.formSchemaText"
                  type="textarea"
                  :rows="18"
                  class="font-mono"
                />
              </ElFormItem>
              <ElFormItem :label="$t('templateEditor.outputSchema')">
                <ElInput
                  v-model="form.outputSchemaText"
                  type="textarea"
                  :rows="18"
                  class="font-mono"
                />
              </ElFormItem>
            </div>
          </ElCollapseItem>
          <ElCollapseItem :title="$t('templateEditor.preview')" name="preview">
            <ElForm label-position="top" class="grid gap-x-5 md:grid-cols-2">
              <ElFormItem v-for="item in previewFields" :key="item.key" :label="item.label">
                <ElSwitch v-if="item.type === 'boolean'" disabled />
                <ElSelect
                  v-else-if="item.options"
                  disabled
                  :placeholder="item.label"
                  class="w-full"
                >
                  <ElOption
                    v-for="option in item.options"
                    :key="String(option)"
                    :value="option"
                    :label="String(option)"
                  />
                </ElSelect>
                <ElInput
                  v-else
                  disabled
                  :type="item.maxLength > 100 ? 'textarea' : 'text'"
                  :placeholder="item.label"
                />
              </ElFormItem>
            </ElForm>
          </ElCollapseItem>
        </ElCollapse>
        <div class="mt-5 flex justify-end border-t border-g-200 pt-5">
          <ElButton type="primary" :loading="saving" @click="save">
            {{ $t('templateEditor.save') }}
          </ElButton>
        </div>
      </ElCard>

      <ElCard class="art-card-sm">
        <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-theme/10 text-sm font-semibold text-theme"
              >03</span
            >
            <div>
              <h2 class="text-base font-semibold text-g-900">{{ $t('templateEditor.testSet') }}</h2>
              <p class="mt-1 text-sm leading-6 text-g-600">{{
                $t('templateEditor.testSetHint')
              }}</p>
            </div>
          </div>
          <ElTag type="info" round>{{
            $t('templateEditor.samplesCount', { count: testCaseCount })
          }}</ElTag>
        </div>
        <div class="mb-3 flex justify-end">
          <ElButton @click="fillSamples">{{ $t('templateEditor.makeSamples') }}</ElButton>
        </div>
        <ElInput v-model="form.testCasesText" type="textarea" :rows="9" class="font-mono" />
        <ElProgress class="mt-5" :percentage="testProgress" :show-text="false" />
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span class="text-sm text-g-600">{{
            $t('templateEditor.passed', { count: passedCount, total: draft.testCases.length })
          }}</span>
          <div class="flex flex-wrap gap-2">
            <ElButton v-if="running" @click="stopRequested = true">{{
              $t('templateEditor.stop')
            }}</ElButton>
            <ElButton type="primary" :disabled="!canEvaluate" :loading="running" @click="runTests">
              {{ $t('templateEditor.runTests') }}
            </ElButton>
          </div>
        </div>
        <ElCollapse v-if="passedCount" class="mt-5">
          <ElCollapseItem
            v-for="(result, index) in draft.evaluation?.results ?? {}"
            :key="index"
            :name="index"
            :title="$t('templateEditor.caseResult', { index: Number(index) + 1 })"
          >
            <pre class="overflow-x-auto rounded-lg bg-g-100 p-4 text-xs leading-5 text-g-700">{{
              formatJson(result.output)
            }}</pre>
          </ElCollapseItem>
        </ElCollapse>
      </ElCard>

      <ElCard v-if="isSuperAdmin" class="art-card-sm">
        <div class="flex items-start gap-3">
          <span
            class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-theme/10 text-sm font-semibold text-theme"
            >04</span
          >
          <div>
            <h2 class="text-base font-semibold text-g-900">{{
              $t('templateEditor.reviewPublish')
            }}</h2>
            <p class="mt-1 text-sm leading-6 text-g-600">{{ $t('templateEditor.reviewHint') }}</p>
          </div>
        </div>
        <ElInput
          v-model="reviewNote"
          class="mt-4"
          type="textarea"
          :rows="3"
          :maxlength="1000"
          show-word-limit
          :placeholder="$t('templateEditor.reviewPlaceholder')"
        />
        <div class="mt-4 flex flex-wrap justify-end gap-2 border-t border-g-200 pt-4">
          <ElButton :disabled="!canReview" :loading="reviewing" @click="submitReview">
            {{ $t('templateEditor.approve') }}
          </ElButton>
          <ElButton type="primary" :disabled="!canPublish" :loading="publishing" @click="publish">
            {{ $t('templateEditor.publish') }}
          </ElButton>
        </div>
      </ElCard>
    </template>
  </div>
</template>

<script setup lang="ts">
  import {
    fetchManagedDraft,
    publishManagedDraft,
    reviewManagedDraft,
    saveManagedDraft,
    testManagedCase,
    type ManagedTemplateDraft
  } from '@/api/templates'
  import { useUserStore } from '@/store/modules/user'
  import { HttpError } from '@/utils/http/error'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'

  defineOptions({ name: 'ManagedTemplateEditor' })
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const userStore = useUserStore()
  const code = computed(() => String(route.params.code ?? ''))
  const draft = ref<ManagedTemplateDraft | null>(null)
  const form = reactive({
    description: '',
    developerPrompt: '',
    changeLog: '',
    maxOutputTokens: 512,
    formSchemaText: '{}',
    outputSchemaText: '{}',
    testCasesText: '[]'
  })
  const loadError = ref(false)
  const saving = ref(false)
  const running = ref(false)
  const reviewing = ref(false)
  const publishing = ref(false)
  const stopRequested = ref(false)
  const reviewNote = ref('')
  const isSuperAdmin = computed(() => userStore.info.roles?.includes('R_SUPER') ?? false)
  const formatJson = (value: unknown) => JSON.stringify(value, null, 2)

  const syncForm = (value: ManagedTemplateDraft) => {
    form.description = value.description
    form.developerPrompt = value.developerPrompt
    form.changeLog = value.changeLog
    form.maxOutputTokens = value.maxOutputTokens
    form.formSchemaText = formatJson(value.formSchema)
    form.outputSchemaText = formatJson(value.outputSchema)
    form.testCasesText = formatJson(value.testCases)
    reviewNote.value = value.evaluation?.note ?? ''
  }
  const isClean = computed(
    () =>
      !!draft.value &&
      form.description === draft.value.description &&
      form.developerPrompt === draft.value.developerPrompt &&
      form.changeLog === draft.value.changeLog &&
      form.maxOutputTokens === draft.value.maxOutputTokens &&
      form.formSchemaText === formatJson(draft.value.formSchema) &&
      form.outputSchemaText === formatJson(draft.value.outputSchema) &&
      form.testCasesText === formatJson(draft.value.testCases)
  )
  const parsedFormSchema = computed(() => {
    try {
      return JSON.parse(form.formSchemaText) as Record<string, unknown>
    } catch {
      return null
    }
  })
  const legacyLabels: Record<string, string> = {
    topic: '内容主题',
    audience: '目标受众',
    sellingPoints: '核心卖点',
    style: '标题风格'
  }
  const previewFields = computed(() => {
    const schema = parsedFormSchema.value
    if (!schema || !schema.properties || typeof schema.properties !== 'object') return []
    return Object.entries(schema.properties).map(([key, raw]) => {
      const field = raw as Record<string, unknown>
      return {
        key,
        label: String(field.title ?? legacyLabels[key] ?? key),
        type: field.type,
        options: Array.isArray(field.enum) ? field.enum : null,
        maxLength: Number(field.maxLength ?? 0)
      }
    })
  })
  const fieldRows = computed(() => {
    const schema = parsedFormSchema.value
    if (!schema || !schema.properties || typeof schema.properties !== 'object') return []
    const required = Array.isArray(schema.required) ? schema.required : []
    return Object.entries(schema.properties).map(([key, raw]) => {
      const field = raw as Record<string, unknown>
      return {
        key,
        label: String(field.title ?? legacyLabels[key] ?? key),
        required: required.includes(key),
        canMax: field.type === 'string' && !Array.isArray(field.enum),
        minLength: Number(field.minLength ?? 0),
        maxLength: Number(field.maxLength ?? 10000)
      }
    })
  })
  const updateField = (
    key: string,
    name: 'title' | 'maxLength',
    value: string | number | undefined
  ) => {
    const schema = parsedFormSchema.value
    if (
      !schema ||
      !schema.properties ||
      typeof schema.properties !== 'object' ||
      value === undefined
    )
      return
    const fields = schema.properties as Record<string, Record<string, unknown>>
    if (!fields[key]) return
    fields[key][name] = value
    form.formSchemaText = formatJson(schema)
  }
  const testCaseCount = computed(() => {
    try {
      const cases = JSON.parse(form.testCasesText)
      return Array.isArray(cases) ? cases.length : 0
    } catch {
      return 0
    }
  })
  const sampleTopics = [
    '周末轻量露营',
    '通勤穿搭灵感',
    '办公室收纳',
    '社区读书会',
    '春季运动计划',
    '新手做饭记录',
    '城市短途散步',
    '节日手作礼物',
    '团队项目复盘',
    '校园环保活动',
    '亲子阅读安排',
    '雨天室内活动',
    '家庭阳台种植',
    '周末预算规划',
    '小型团队会议',
    '毕业旅行准备',
    '居家学习方法',
    '志愿服务记录',
    '线下展览参观',
    '个人时间管理'
  ]
  const sampleText = (key: string, index: number) => {
    const topic = sampleTopics[index]
    const values: Record<string, string> = {
      topic,
      researchTopic: `${topic}的研究思路`,
      originalText: `我计划围绕${topic}整理一份内容，先说明背景，再列出实际做法，最后保留仍需确认的问题。`,
      rawNotes: `会议讨论了${topic}的准备工作。大家提出先整理现有资料，再确认执行时间；目前没有形成最终决议，也未确定负责人和截止日期。`,
      completedItems: `本周完成了${topic}的资料整理、初步分类和内部沟通，并记录了仍待确认的事项。`,
      nextWeekPlan: `下周计划继续核对${topic}的细节，与相关人员确认后再安排下一步。`,
      keyPoints: `${topic}的背景、目前已经确认的信息，以及需要进一步核实的细节。`,
      purpose: `说明${topic}的安排`,
      recipientRole: '项目协作同事',
      sellingPoints: '准备简单，适合周末',
      audience: '第一次尝试的上班族',
      meetingTitle: `${topic}讨论会`,
      meetingDate: '2026-10-22',
      subject: `关于${topic}的沟通`,
      discipline: '社会科学',
      writingDirection: '从个人观察切入，突出具体感受',
      researchFocus: '分析适用场景与仍待验证的问题',
      achievements: '完成了已有资料的整理',
      problems: '部分细节尚未确认'
    }
    return values[key] ?? `${topic}的相关信息与待确认事项`
  }
  const fillSamples = async () => {
    const schema = parsedFormSchema.value
    if (!schema || !schema.properties || typeof schema.properties !== 'object') return
    if (testCaseCount.value > 0) {
      try {
        await ElMessageBox.confirm(
          t('templateEditor.replaceSamples'),
          t('templateEditor.makeSamples'),
          { type: 'warning' }
        )
      } catch {
        return
      }
    }
    const required = Array.isArray(schema.required) ? schema.required : []
    const fields = schema.properties as Record<string, Record<string, unknown>>
    const cases = sampleTopics.map((_, index) => {
      const input: Record<string, unknown> = {}
      for (const [key, field] of Object.entries(fields)) {
        if (!required.includes(key) && index % 4 === 0) continue
        if (field.type === 'boolean') input[key] = index % 2 === 0
        else if (Array.isArray(field.enum)) input[key] = field.enum[index % field.enum.length]
        else {
          const max = Number(field.maxLength ?? 10000)
          const min = Number(field.minLength ?? 0)
          let value = sampleText(key, index)
          if (value.length < min) value = value.padEnd(min, '。')
          input[key] = value.slice(0, max)
        }
      }
      return input
    })
    form.testCasesText = formatJson(cases)
    ElMessage.info(t('templateEditor.samplesReady'))
  }
  const passedCount = computed(
    () => Object.values(draft.value?.evaluation?.results ?? {}).filter((item) => item.passed).length
  )
  const testProgress = computed(() =>
    draft.value?.testCases.length
      ? Math.round((passedCount.value / draft.value.testCases.length) * 100)
      : 0
  )
  const canEvaluate = computed(
    () =>
      !!draft.value?.saved &&
      !!draft.value.revision &&
      isClean.value &&
      draft.value.testCases.length >= 20 &&
      !saving.value &&
      !running.value
  )
  const canReview = computed(
    () =>
      isSuperAdmin.value &&
      canEvaluate.value &&
      passedCount.value === draft.value?.testCases.length &&
      !!reviewNote.value.trim() &&
      reviewNote.value.length <= 1000 &&
      !reviewing.value
  )
  const canPublish = computed(
    () =>
      isSuperAdmin.value &&
      canEvaluate.value &&
      !!draft.value?.evaluation?.approvedBy &&
      !publishing.value
  )

  const loadDraft = async () => {
    loadError.value = false
    try {
      draft.value = await fetchManagedDraft(code.value)
      syncForm(draft.value)
    } catch {
      draft.value = null
      loadError.value = true
    }
  }
  const save = async () => {
    if (!draft.value || saving.value) return
    let formSchema: unknown, outputSchema: unknown, testCases: unknown
    try {
      formSchema = JSON.parse(form.formSchemaText)
      outputSchema = JSON.parse(form.outputSchemaText)
      testCases = JSON.parse(form.testCasesText)
    } catch {
      ElMessage.error(t('templateEditor.jsonInvalid'))
      return
    }
    if (!Array.isArray(testCases)) {
      ElMessage.error(t('templateEditor.jsonInvalid'))
      return
    }
    saving.value = true
    try {
      const saved = await saveManagedDraft(code.value, {
        description: form.description,
        developerPrompt: form.developerPrompt,
        changeLog: form.changeLog,
        maxOutputTokens: form.maxOutputTokens,
        formSchema,
        outputSchema,
        testCases,
        revision: draft.value.revision
      })
      draft.value = saved
      syncForm(saved)
      ElMessage.success(t('templateEditor.saveSuccess'))
    } catch (error) {
      ElMessage.error(error instanceof HttpError ? error.message : t('templateEditor.saveFailed'))
    } finally {
      saving.value = false
    }
  }
  const runTests = async () => {
    if (!canEvaluate.value || !draft.value?.revision) return
    try {
      await ElMessageBox.confirm(
        t('templateEditor.testConfirm', { count: draft.value.testCases.length }),
        t('templateEditor.runTests'),
        { type: 'warning' }
      )
    } catch {
      return
    }
    const revision = draft.value.revision
    const caseCount = draft.value.testCases.length
    const templateCode = code.value
    running.value = true
    stopRequested.value = false
    try {
      for (let index = 0; index < caseCount; index++) {
        if (stopRequested.value || code.value !== templateCode || !draft.value) break
        if (draft.value.evaluation?.results[String(index)]?.passed) continue
        await testManagedCase(templateCode, revision, index)
        // 服务端按版本保存结果，逐条刷新便于中断后继续执行。
        await loadDraft()
      }
      if (!stopRequested.value) ElMessage.success(t('templateEditor.testFinished'))
    } catch (error) {
      ElMessage.error(error instanceof HttpError ? error.message : t('templateEditor.testFailed'))
      await loadDraft()
    } finally {
      running.value = false
    }
  }
  const submitReview = async () => {
    if (!canReview.value || !draft.value?.revision) return
    reviewing.value = true
    try {
      draft.value = await reviewManagedDraft(code.value, draft.value.revision, reviewNote.value)
      ElMessage.success(t('templateEditor.reviewSuccess'))
    } catch (error) {
      ElMessage.error(error instanceof HttpError ? error.message : t('templateEditor.reviewFailed'))
    } finally {
      reviewing.value = false
    }
  }
  const publish = async () => {
    if (!canPublish.value || !draft.value?.revision) return
    try {
      await ElMessageBox.confirm(t('templateEditor.publishConfirm'), t('templateEditor.publish'), {
        type: 'warning'
      })
    } catch {
      return
    }
    publishing.value = true
    try {
      await publishManagedDraft(code.value, draft.value.revision)
      ElMessage.success(t('templateEditor.publishSuccess'))
      await loadDraft()
    } catch (error) {
      ElMessage.error(
        error instanceof HttpError ? error.message : t('templateEditor.publishFailed')
      )
    } finally {
      publishing.value = false
    }
  }
  watch(code, () => {
    stopRequested.value = true
    void loadDraft()
  })
  onBeforeUnmount(() => {
    stopRequested.value = true
  })
  onMounted(loadDraft)
</script>
