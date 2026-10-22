<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <ElButton link type="primary" @click="router.push({ name: 'TemplateList' })">
          <ArtSvgIcon icon="ri:arrow-left-line" class="mr-1" />
          {{ $t('templateDraft.back') }}
        </ElButton>
        <h1 class="mt-3 text-xl font-semibold text-g-900">{{ $t('templateDraft.title') }}</h1>
        <p class="mt-1 text-sm text-g-600">{{ $t('templateDraft.subtitle') }}</p>
      </div>
      <ElTag :type="draft?.saved ? 'warning' : 'info'" size="large" round>
        {{ draft?.saved ? $t('templateDraft.saved') : $t('templateDraft.unsaved') }}
      </ElTag>
    </div>

    <ElAlert v-if="loadError" type="error" :closable="false">
      <template #title>
        {{ $t('templateDraft.loadFailed') }}
        <ElButton link type="primary" @click="loadDraft">{{ $t('templateDraft.retry') }}</ElButton>
      </template>
    </ElAlert>

    <template v-if="draft">
      <ElCard class="art-card-sm">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div>
            <p class="font-semibold text-g-900">{{ draft.template.name }}</p>
            <p class="mt-1 font-mono text-xs text-g-500">{{ draft.template.code }}</p>
          </div>
          <ElTag type="info" effect="plain">{{
            $t('templateDraft.version', { version: draft.version })
          }}</ElTag>
          <span class="text-sm text-g-600">{{ draft.template.description }}</span>
        </div>
      </ElCard>

      <div class="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <ElCard class="art-card-sm">
          <ElForm ref="formRef" :model="form" :rules="rules" label-position="top">
            <div class="mb-5">
              <h2 class="text-base font-semibold text-g-900">{{
                $t('templateDraft.promptTitle')
              }}</h2>
              <p class="mt-1 text-sm leading-6 text-g-600">{{ $t('templateDraft.promptHint') }}</p>
            </div>
            <ElFormItem prop="developerPrompt">
              <ElInput
                v-model="form.developerPrompt"
                type="textarea"
                :rows="17"
                resize="vertical"
                :maxlength="10000"
                show-word-limit
                :placeholder="$t('templateDraft.promptPlaceholder')"
              />
            </ElFormItem>
            <ElFormItem prop="changeLog" :label="$t('templateDraft.changeLog')">
              <ElInput
                v-model="form.changeLog"
                type="textarea"
                :rows="3"
                resize="vertical"
                :maxlength="500"
                show-word-limit
                :placeholder="$t('templateDraft.changeLogPlaceholder')"
              />
            </ElFormItem>
            <div class="flex justify-end">
              <ElButton type="primary" :loading="saving" @click="saveDraft">
                {{ $t('templateDraft.save') }}
              </ElButton>
            </div>
          </ElForm>
        </ElCard>

        <ElCard class="art-card-sm h-fit">
          <h2 class="text-base font-semibold text-g-900">{{
            $t('templateDraft.contractTitle')
          }}</h2>
          <p class="mt-1 text-sm leading-6 text-g-600">{{ $t('templateDraft.contractHint') }}</p>
          <h3 class="mt-6 text-sm font-semibold text-g-900">{{
            $t('templateDraft.inputTitle')
          }}</h3>
          <ul class="mt-3 space-y-3 text-sm text-g-700">
            <li v-for="key in inputFieldKeys" :key="key" class="flex items-start gap-2">
              <ArtSvgIcon icon="ri:checkbox-circle-line" class="mt-0.5 shrink-0 text-theme" />
              <span>{{ $t(`templateDraft.${key}`) }}</span>
            </li>
          </ul>
          <h3 class="mt-6 text-sm font-semibold text-g-900">{{
            $t('templateDraft.outputTitle')
          }}</h3>
          <p class="mt-2 text-sm leading-6 text-g-700">{{ $t('templateDraft.outputItems') }}</p>
          <ElAlert
            class="mt-6"
            type="info"
            :closable="false"
            :title="$t('templateDraft.modelHint')"
          />
        </ElCard>
      </div>

      <ElCard class="art-card-sm">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-g-900">{{ $t('templateDraft.testTitle') }}</h2>
            <p class="mt-1 text-sm leading-6 text-g-600">{{ $t('templateDraft.testHint') }}</p>
          </div>
          <ElTag type="info" effect="plain">{{
            $t('templateDraft.testVersion', { version: draft.version })
          }}</ElTag>
        </div>

        <ElAlert
          v-if="!canTest"
          class="mb-5"
          type="warning"
          :closable="false"
          :title="$t('templateDraft.testUnsavedHint')"
        />

        <ElForm ref="testFormRef" :model="testInputs" :rules="testRules" label-position="top">
          <div class="grid gap-x-5 md:grid-cols-2">
            <ElFormItem prop="topic" :label="$t('templateDraft.testTopic')">
              <ElInput v-model="testInputs.topic" :maxlength="80" show-word-limit />
            </ElFormItem>
            <ElFormItem prop="style" :label="$t('templateDraft.testStyle')">
              <ElSelect v-model="testInputs.style" class="w-full">
                <ElOption v-for="style in testStyles" :key="style" :label="style" :value="style" />
              </ElSelect>
            </ElFormItem>
            <ElFormItem prop="audience" :label="$t('templateDraft.testAudience')">
              <ElInput v-model="testInputs.audience" :maxlength="50" show-word-limit />
            </ElFormItem>
            <ElFormItem prop="sellingPoints" :label="$t('templateDraft.testSellingPoints')">
              <ElInput
                v-model="testInputs.sellingPoints"
                type="textarea"
                :rows="2"
                :maxlength="300"
                show-word-limit
              />
            </ElFormItem>
          </div>
          <div class="flex justify-end">
            <ElButton type="primary" :loading="testing" :disabled="!canTest" @click="runTest">
              {{ $t('templateDraft.testRun') }}
            </ElButton>
          </div>
        </ElForm>

        <ElAlert v-if="testError" class="mt-5" type="error" :closable="false" :title="testError" />

        <div v-if="testResult" class="mt-6 border-t border-g-300 pt-5">
          <div class="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-g-600">
            <h3 class="mr-auto text-base font-semibold text-g-900">{{
              $t('templateDraft.testResultTitle')
            }}</h3>
            <span>{{ $t('templateDraft.testModel') }}：{{ testResult.model }}</span>
            <span>{{ $t('templateDraft.testDuration') }}：{{ testResult.durationMs }} ms</span>
            <span v-if="testResult.tokenUsage">
              {{ $t('templateDraft.testTokens') }}：{{ testResult.tokenUsage.total }} ({{
                testResult.tokenUsage.input
              }}
              / {{ testResult.tokenUsage.output }})
            </span>
            <span v-else>{{ $t('templateDraft.testTokens') }}：—</span>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <div
              v-for="(item, index) in testResult.items"
              :key="index"
              class="rounded-lg border border-g-300 p-4"
            >
              <div class="flex items-start gap-3">
                <span class="text-sm font-medium text-g-500">{{ index + 1 }}.</span>
                <div class="min-w-0 flex-1">
                  <p class="font-medium leading-6 text-g-900">{{ item.title }}</p>
                  <ElTag class="mt-2" size="small" type="info" effect="plain">{{
                    item.angle
                  }}</ElTag>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ElCard>

      <ElCard v-if="isSuperAdmin" class="art-card-sm">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-base font-semibold text-g-900">{{
              $t('templateDraft.publishTitle')
            }}</h2>
            <p class="mt-1 text-sm leading-6 text-g-600">{{ $t('templateDraft.publishHint') }}</p>
          </div>
          <ElButton
            type="primary"
            :loading="publishing"
            :disabled="!canPublish"
            @click="publishDraft"
          >
            {{ $t('templateDraft.publish') }}
          </ElButton>
        </div>
      </ElCard>
    </template>
  </div>
</template>

<script setup lang="ts">
  import {
    fetchXhsTitleDraft,
    publishXhsTitleDraft,
    saveXhsTitleDraft,
    testXhsTitleDraft,
    type AdminTemplateDraft,
    type AdminXhsTitleTestRequest,
    type AdminXhsTitleTestResult
  } from '@/api/templates'
  import { HttpError } from '@/utils/http/error'
  import { useUserStore } from '@/store/modules/user'
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'

  defineOptions({ name: 'XhsTitleDraft' })

  const { t } = useI18n()
  const router = useRouter()
  const userStore = useUserStore()
  const formRef = ref<FormInstance>()
  const testFormRef = ref<FormInstance>()
  const draft = ref<AdminTemplateDraft | null>(null)
  const form = reactive({ developerPrompt: '', changeLog: '' })
  const testInputs = reactive<AdminXhsTitleTestRequest['inputs']>({
    topic: '',
    audience: '',
    sellingPoints: '',
    style: '真实'
  })
  const testStyles = ['真实', '活泼', '专业'] as const
  const saving = ref(false)
  const testing = ref(false)
  const publishing = ref(false)
  const loadError = ref(false)
  const testError = ref('')
  const testResult = ref<AdminXhsTitleTestResult | null>(null)
  const canTest = computed(
    () => !!draft.value?.saved && form.developerPrompt === draft.value.developerPrompt
  )
  const isSuperAdmin = computed(() => userStore.info.roles?.includes('R_SUPER') ?? false)
  const canPublish = computed(
    () =>
      !!draft.value?.revision &&
      canTest.value &&
      form.changeLog === draft.value.changeLog &&
      !saving.value &&
      !testing.value
  )
  const inputFieldKeys = ['fieldTopic', 'fieldAudience', 'fieldSellingPoints', 'fieldStyle']
  const rules = computed<FormRules>(() => ({
    developerPrompt: [
      {
        required: true,
        whitespace: true,
        message: t('templateDraft.promptRequired'),
        trigger: 'blur'
      },
      { max: 10000, message: t('templateDraft.maxPrompt'), trigger: 'blur' }
    ],
    changeLog: [
      {
        required: true,
        whitespace: true,
        message: t('templateDraft.changeLogRequired'),
        trigger: 'blur'
      },
      { max: 500, message: t('templateDraft.maxChangeLog'), trigger: 'blur' }
    ]
  }))
  const testRules = computed<FormRules>(() => ({
    topic: [
      {
        required: true,
        whitespace: true,
        message: t('templateDraft.testTopicRequired'),
        trigger: 'blur'
      },
      { min: 2, max: 80, message: t('templateDraft.testTopicLength'), trigger: 'blur' }
    ],
    style: [{ required: true, message: t('templateDraft.testStyleRequired'), trigger: 'change' }]
  }))

  const loadDraft = async () => {
    loadError.value = false
    try {
      draft.value = await fetchXhsTitleDraft()
      form.developerPrompt = draft.value.developerPrompt
      form.changeLog = draft.value.changeLog
      testResult.value = null
      testError.value = ''
      await nextTick()
      formRef.value?.clearValidate()
    } catch {
      draft.value = null
      loadError.value = true
    }
  }

  const saveDraft = async () => {
    if (!draft.value || saving.value || !formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    saving.value = true
    try {
      // 保留服务端返回的 revision，避免重复保存时覆盖其他管理员在间隙中完成的修改。
      draft.value = await saveXhsTitleDraft({
        developerPrompt: form.developerPrompt,
        changeLog: form.changeLog,
        revision: draft.value.revision
      })
      form.developerPrompt = draft.value.developerPrompt
      form.changeLog = draft.value.changeLog
      testResult.value = null
      testError.value = ''
      ElMessage.success(t('templateDraft.saveSuccess'))
    } catch (error) {
      ElMessage.error(
        error instanceof HttpError && error.code === 409
          ? t('templateDraft.conflict')
          : t('templateDraft.saveFailed')
      )
    } finally {
      saving.value = false
    }
  }

  const runTest = async () => {
    if (!draft.value?.revision || !canTest.value || testing.value || !testFormRef.value) return
    const valid = await testFormRef.value.validate().catch(() => false)
    if (!valid) return
    testing.value = true
    testResult.value = null
    testError.value = ''
    const revision = draft.value.revision
    const prompt = form.developerPrompt
    try {
      const result = await testXhsTitleDraft({
        revision,
        inputs: { ...testInputs }
      })
      // 调用期间可能继续编辑或保存草稿，旧版本结果不能展示为当前草稿的测试结果。
      if (draft.value?.revision === revision && form.developerPrompt === prompt) {
        testResult.value = result
      }
    } catch (error) {
      if (draft.value?.revision === revision && form.developerPrompt === prompt) {
        testError.value = error instanceof HttpError ? error.message : t('templateDraft.testFailed')
      }
    } finally {
      testing.value = false
    }
  }

  const publishDraft = async () => {
    if (!isSuperAdmin.value || !canPublish.value || publishing.value || !draft.value?.revision)
      return
    try {
      await ElMessageBox.confirm(
        t('templateDraft.publishConfirm'),
        t('templateDraft.publishTitle'),
        {
          type: 'warning',
          confirmButtonText: t('templateDraft.publish'),
          cancelButtonText: t('templateDraft.cancel')
        }
      )
    } catch {
      return
    }
    publishing.value = true
    try {
      await publishXhsTitleDraft({ revision: draft.value.revision })
      ElMessage.success(t('templateDraft.publishSuccess'))
      await loadDraft()
    } catch (error) {
      ElMessage.error(
        error instanceof HttpError && error.code === 409
          ? t('templateDraft.conflict')
          : error instanceof HttpError && error.code === 403
            ? t('templateDraft.publishForbidden')
            : t('templateDraft.publishFailed')
      )
    } finally {
      publishing.value = false
    }
  }

  watch(
    () => form.developerPrompt,
    () => {
      testResult.value = null
    }
  )

  onMounted(loadDraft)
</script>
