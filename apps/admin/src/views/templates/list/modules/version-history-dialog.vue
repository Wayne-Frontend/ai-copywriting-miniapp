<template>
  <ElDialog
    v-model="dialogVisible"
    :title="$t('templateManagement.versionHistoryTitle', { name: template?.name ?? '' })"
    width="min(960px, 92vw)"
    align-center
    destroy-on-close
  >
    <div class="max-h-[72vh] space-y-4 overflow-y-auto pr-1 md:space-y-5">
      <ElAlert
        v-if="versionsError"
        type="error"
        :closable="false"
        :title="$t('templateManagement.versionsLoadFailed')"
      >
        <ElButton link type="primary" @click="loadVersions">{{
          $t('templateManagement.retry')
        }}</ElButton>
      </ElAlert>

      <ElCard v-if="!versionsError" class="art-card-sm">
        <h3 class="mb-4 text-sm font-semibold text-g-900">{{
          $t('templateManagement.publishedVersions')
        }}</h3>
        <ElSkeleton v-if="versionsLoading" :rows="3" animated />
        <ElEmpty
          v-else-if="versions.length === 0"
          class="py-4"
          :image-size="100"
          :description="$t('templateManagement.noPublishedVersions')"
        />
        <div v-else class="overflow-x-auto">
          <ArtTable class="min-w-[680px]" :data="versions" row-key="version">
            <ElTableColumn :label="$t('templateManagement.version')" width="140">
              <template #default="{ row }">
                <ElButton link type="primary" @click="selectVersion(row.version)">
                  v{{ row.version }}
                </ElButton>
                <ElTag v-if="row.isCurrent" class="ml-1" size="small" type="success">
                  {{ $t('templateManagement.currentVersion') }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="changeLog"
              :label="$t('templateManagement.changeLog')"
              min-width="210"
              show-overflow-tooltip
            />
            <ElTableColumn prop="model" :label="$t('templateManagement.model')" min-width="120">
              <template #default="{ row }">{{ row.model ?? '—' }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('templateManagement.publishedBy')" min-width="115">
              <template #default="{ row }">{{ row.publishedByUsername ?? '—' }}</template>
            </ElTableColumn>
            <ElTableColumn :label="$t('templateManagement.publishedAt')" min-width="165">
              <template #default="{ row }">{{
                row.publishedAt ? formatDate(row.publishedAt) : '—'
              }}</template>
            </ElTableColumn>
          </ArtTable>
        </div>
      </ElCard>

      <ElAlert
        v-if="detailError"
        type="error"
        :closable="false"
        :title="$t('templateManagement.versionDetailFailed')"
      />
      <ElSkeleton v-if="detailLoading" :rows="8" animated />
      <ElCard v-else-if="detail" class="art-card-sm">
        <div class="mb-5 flex flex-wrap items-center gap-3">
          <h3 class="text-base font-semibold text-g-900">
            {{ $t('templateManagement.versionDetail', { version: detail.version }) }}
          </h3>
          <ElTag v-if="detail.isCurrent" size="small" type="success">
            {{ $t('templateManagement.currentVersion') }}
          </ElTag>
          <ElButton
            v-if="canRollback"
            class="w-full sm:ml-auto sm:w-auto"
            type="warning"
            plain
            :loading="rollbackUpdating"
            @click="rollbackVersion"
          >
            {{ $t('templateManagement.rollback') }}
          </ElButton>
        </div>
        <ElDescriptions :column="descriptionColumns" border>
          <ElDescriptionsItem :label="$t('templateManagement.model')">{{
            detail.model ?? '—'
          }}</ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('templateManagement.systemPromptVersion')">
            {{ detail.systemPromptVersion }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('templateManagement.publishedBy')">
            {{ detail.publishedByUsername ?? '—' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem :label="$t('templateManagement.publishedAt')">
            {{ detail.publishedAt ? formatDate(detail.publishedAt) : '—' }}
          </ElDescriptionsItem>
        </ElDescriptions>
        <h4 v-if="detail.description" class="mt-6 mb-2 text-sm font-semibold text-g-900">{{
          $t('templateEditor.description')
        }}</h4>
        <p v-if="detail.description" class="whitespace-pre-wrap text-sm leading-6 text-g-700">{{
          detail.description
        }}</p>
        <h4 class="mt-6 mb-2 text-sm font-semibold text-g-900">{{
          $t('templateManagement.changeLog')
        }}</h4>
        <p class="whitespace-pre-wrap text-sm leading-6 text-g-700">{{ detail.changeLog }}</p>
        <h4 class="mt-6 mb-2 text-sm font-semibold text-g-900">Developer Prompt</h4>
        <div class="max-h-72 overflow-y-auto rounded-lg bg-g-100 p-4">
          <pre class="whitespace-pre-wrap break-words text-sm leading-6 text-g-700">{{
            detail.developerPrompt
          }}</pre>
        </div>
        <ElCollapse class="mt-6">
          <ElCollapseItem :title="$t('templateManagement.formSchema')" name="form">
            <pre
              class="max-h-64 overflow-auto rounded-lg bg-g-100 p-4 text-xs leading-5 text-g-700"
              >{{ formatJson(detail.formSchema) }}</pre>
          </ElCollapseItem>
          <ElCollapseItem :title="$t('templateManagement.outputSchema')" name="output">
            <pre
              class="max-h-64 overflow-auto rounded-lg bg-g-100 p-4 text-xs leading-5 text-g-700"
              >{{ formatJson(detail.outputSchema) }}</pre>
          </ElCollapseItem>
          <ElCollapseItem :title="$t('templateManagement.modelConfig')" name="model">
            <pre
              class="max-h-64 overflow-auto rounded-lg bg-g-100 p-4 text-xs leading-5 text-g-700"
              >{{ formatJson(detail.modelConfig) }}</pre>
          </ElCollapseItem>
        </ElCollapse>
      </ElCard>
    </div>
  </ElDialog>
</template>

<script setup lang="ts">
  import {
    fetchManagedVersion,
    fetchManagedVersions,
    rollbackManagedVersion,
    type AdminPublishedTemplateVersion,
    type AdminPublishedTemplateVersionDetail,
    type AdminTemplateListItem
  } from '@/api/templates'
  import { useUserStore } from '@/store/modules/user'
  import { HttpError } from '@/utils/http/error'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useI18n } from 'vue-i18n'
  import { useWindowSize } from '@vueuse/core'

  const props = defineProps<{ visible: boolean; template: AdminTemplateListItem | null }>()
  const emit = defineEmits<{
    (event: 'update:visible', value: boolean): void
    (event: 'changed'): void
  }>()
  const { locale, t } = useI18n()
  const userStore = useUserStore()
  const { width } = useWindowSize()
  const descriptionColumns = computed(() => (width.value < 640 ? 1 : 2))
  const dialogVisible = computed({
    get: () => props.visible,
    set: (visible) => emit('update:visible', visible)
  })
  const versions = ref<AdminPublishedTemplateVersion[]>([])
  const detail = ref<AdminPublishedTemplateVersionDetail | null>(null)
  const versionsLoading = ref(false)
  const detailLoading = ref(false)
  const versionsError = ref(false)
  const detailError = ref(false)
  const rollbackUpdating = ref(false)
  const currentVersion = computed(() => versions.value.find((item) => item.isCurrent)?.version)
  const canRollback = computed(
    () =>
      userStore.info.roles?.includes('R_SUPER') &&
      detail.value &&
      !detail.value.isCurrent &&
      currentVersion.value &&
      props.template?.code &&
      ['active', 'disabled'].includes(props.template.status)
  )
  let versionsRequestSequence = 0
  let detailRequestSequence = 0

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value)
    )
  const formatJson = (value: unknown) => JSON.stringify(value, null, 2)

  const rollbackVersion = async () => {
    if (
      !canRollback.value ||
      !detail.value ||
      !currentVersion.value ||
      !props.template ||
      rollbackUpdating.value
    )
      return
    const targetVersion = detail.value.version
    const expectedCurrentVersion = currentVersion.value
    let reason: string
    try {
      const answer = await ElMessageBox.prompt(
        t('templateManagement.rollbackConfirm', {
          from: expectedCurrentVersion,
          to: targetVersion,
          status: t(
            props.template.status === 'active'
              ? 'templateManagement.statusActive'
              : 'templateManagement.statusDisabled'
          )
        }),
        t('templateManagement.rollback'),
        {
          type: 'warning',
          confirmButtonText: t('templateManagement.rollback'),
          cancelButtonText: t('templateManagement.cancel'),
          inputPlaceholder: t('templateManagement.rollbackReasonPlaceholder'),
          inputValidator: (value) =>
            value.trim().length > 0 && value.trim().length <= 500
              ? true
              : t('templateManagement.rollbackReasonRequired')
        }
      )
      reason = answer.value.trim()
    } catch {
      return
    }
    rollbackUpdating.value = true
    try {
      await rollbackManagedVersion(props.template.code, targetVersion, {
        expectedCurrentVersion,
        expectedStatus: props.template.status as 'active' | 'disabled',
        reason
      })
      ElMessage.success(t('templateManagement.rollbackSuccess', { version: targetVersion }))
      dialogVisible.value = false
      emit('changed')
    } catch (error) {
      ElMessage.error(
        error instanceof HttpError && error.code === 409
          ? t('templateManagement.rollbackConflict')
          : t('templateManagement.rollbackFailed')
      )
    } finally {
      rollbackUpdating.value = false
    }
  }

  const selectVersion = async (version: number) => {
    const sequence = ++detailRequestSequence
    detailLoading.value = true
    detailError.value = false
    detail.value = null
    try {
      if (!props.template) return
      const loaded = await fetchManagedVersion(props.template.code, version)
      // 对话框关闭或切换版本后，旧请求结果不应覆盖当前选择。
      if (props.visible && sequence === detailRequestSequence) detail.value = loaded
    } catch {
      if (props.visible && sequence === detailRequestSequence) detailError.value = true
    } finally {
      if (sequence === detailRequestSequence) detailLoading.value = false
    }
  }

  const loadVersions = async () => {
    const sequence = ++versionsRequestSequence
    ++detailRequestSequence
    versionsLoading.value = true
    versionsError.value = false
    detailError.value = false
    versions.value = []
    detail.value = null
    try {
      if (!props.template) return
      const loaded = await fetchManagedVersions(props.template.code)
      if (!props.visible || sequence !== versionsRequestSequence) return
      versions.value = loaded
      versionsLoading.value = false
      const selected = loaded.find((item) => item.isCurrent) ?? loaded[0]
      if (selected) await selectVersion(selected.version)
    } catch {
      if (props.visible && sequence === versionsRequestSequence) versionsError.value = true
    } finally {
      if (sequence === versionsRequestSequence) versionsLoading.value = false
    }
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) void loadVersions()
      else {
        ++versionsRequestSequence
        ++detailRequestSequence
        versions.value = []
        detail.value = null
        versionsLoading.value = false
        detailLoading.value = false
      }
    }
  )
</script>
