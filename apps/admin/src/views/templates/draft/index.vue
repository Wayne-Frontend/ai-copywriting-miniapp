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
    </template>
  </div>
</template>

<script setup lang="ts">
  import { fetchXhsTitleDraft, saveXhsTitleDraft, type AdminTemplateDraft } from '@/api/templates'
  import { HttpError } from '@/utils/http/error'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'

  defineOptions({ name: 'XhsTitleDraft' })

  const { t } = useI18n()
  const router = useRouter()
  const formRef = ref<FormInstance>()
  const draft = ref<AdminTemplateDraft | null>(null)
  const form = reactive({ developerPrompt: '', changeLog: '' })
  const saving = ref(false)
  const loadError = ref(false)
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

  const loadDraft = async () => {
    loadError.value = false
    try {
      draft.value = await fetchXhsTitleDraft()
      form.developerPrompt = draft.value.developerPrompt
      form.changeLog = draft.value.changeLog
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

  onMounted(loadDraft)
</script>
