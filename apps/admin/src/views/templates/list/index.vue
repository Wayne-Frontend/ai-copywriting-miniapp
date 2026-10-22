<template>
  <div class="template-page art-full-height">
    <header class="mb-4">
      <h1 class="text-xl font-semibold text-g-900 md:text-2xl">{{
        $t('templateManagement.title')
      }}</h1>
      <p class="mt-1 text-sm text-g-600">{{ $t('templateManagement.description') }}</p>
    </header>
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :button-left-limit="0"
      @search="applySearch"
      @reset="resetSearch"
    />

    <ElCard class="art-table-card min-w-0">
      <ArtTableHeader
        :loading="loading"
        layout="refresh,size,fullscreen,settings"
        @refresh="loadTemplates"
      >
        <template #left>
          <div class="flex items-center gap-2">
            <span class="text-base font-semibold text-g-900">{{
              $t('templateManagement.listTitle')
            }}</span>
            <ElTag size="small" type="info" round>{{ visibleTemplates.length }}</ElTag>
          </div>
        </template>
      </ArtTableHeader>

      <ElAlert v-if="error" type="error" :closable="false" class="mt-4">
        <template #title>
          {{ $t('templateManagement.loadFailed') }}
          <ElButton link type="primary" @click="loadTemplates">{{
            $t('templateManagement.retry')
          }}</ElButton>
        </template>
      </ElAlert>

      <ArtTable
        :data="visibleTemplates"
        :loading="loading"
        :empty-text="
          $t(templates.length ? 'templateManagement.noMatches' : 'templateManagement.empty')
        "
        row-key="id"
      >
        <ElTableColumn prop="name" :label="$t('templateManagement.name')" min-width="240">
          <template #default="{ row }">
            <p class="font-medium text-g-900" :title="row.description">{{ row.name }}</p>
            <p class="mt-1 text-xs text-g-500">{{ row.code }}</p>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="category" :label="$t('templateManagement.category')" min-width="90">
          <template #default="{ row }">
            <ElTag type="info" effect="plain">{{ row.category }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('templateManagement.status')" min-width="95">
          <template #default="{ row }">
            <ElTag :type="row.status === 'active' ? 'success' : 'info'" round>{{
              statusLabel(row.status)
            }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('templateManagement.version')" min-width="105">
          <template #default="{ row }">
            <span class="font-medium text-g-800">{{
              row.currentVersion ? `v${row.currentVersion}` : '—'
            }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('templateManagement.updatedAt')" min-width="170">
          <template #default="{ row }">
            <p>{{ formatDate(row.updatedAt) }}</p>
            <p class="mt-1 text-xs text-g-500">
              {{ $t('templateManagement.updatedBy') }}：{{ row.updatedByUsername ?? '—' }}
            </p>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('templateManagement.actions')" width="176" fixed="right">
          <template #default="{ row }">
            <div class="flex min-h-9 items-center whitespace-nowrap">
              <ElTooltip :content="$t('templateManagement.editDraft')">
                <ArtButtonTable
                  type="edit"
                  role="button"
                  tabindex="0"
                  :aria-label="$t('templateManagement.editDraft')"
                  @click="openTemplateDraft(row)"
                  @keydown.enter="openTemplateDraft(row)"
                  @keydown.space.prevent="openTemplateDraft(row)"
                />
              </ElTooltip>
              <ElTooltip :content="$t('templateManagement.viewVersions')">
                <ArtButtonTable
                  type="view"
                  role="button"
                  tabindex="0"
                  :aria-label="$t('templateManagement.viewVersions')"
                  @click="openTemplateVersions(row)"
                  @keydown.enter="openTemplateVersions(row)"
                  @keydown.space.prevent="openTemplateVersions(row)"
                />
              </ElTooltip>
              <ElTooltip
                v-if="
                  isSuperAdmin && row.currentVersion && ['active', 'disabled'].includes(row.status)
                "
                :content="
                  $t(
                    row.status === 'active'
                      ? 'templateManagement.disable'
                      : 'templateManagement.enable'
                  )
                "
              >
                <ArtButtonTable
                  type="more"
                  :icon="row.status === 'active' ? 'ri:stop-circle-line' : 'ri:play-circle-line'"
                  :icon-class="
                    row.status === 'active'
                      ? 'bg-warning/12 text-warning'
                      : 'bg-success/12 text-success'
                  "
                  role="button"
                  tabindex="0"
                  :aria-label="
                    $t(
                      row.status === 'active'
                        ? 'templateManagement.disable'
                        : 'templateManagement.enable'
                    )
                  "
                  @click="changeAvailability(row)"
                  @keydown.enter="changeAvailability(row)"
                  @keydown.space.prevent="changeAvailability(row)"
                />
              </ElTooltip>
            </div>
          </template>
        </ElTableColumn>
      </ArtTable>
    </ElCard>
    <VersionHistoryDialog
      v-model:visible="versionsVisible"
      :template="selectedTemplate"
      @changed="loadTemplates"
    />
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import VersionHistoryDialog from './modules/version-history-dialog.vue'
  import {
    changeManagedAvailability,
    fetchAdminTemplates,
    type AdminTemplateListItem
  } from '@/api/templates'
  import { useUserStore } from '@/store/modules/user'
  import { HttpError } from '@/utils/http/error'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'TemplateList' })

  const { locale, t } = useI18n()
  const router = useRouter()
  const userStore = useUserStore()
  const templates = ref<AdminTemplateListItem[]>([])
  const loading = ref(false)
  const error = ref(false)
  const versionsVisible = ref(false)
  const selectedTemplate = ref<AdminTemplateListItem | null>(null)
  const availabilityUpdating = ref(false)
  const isSuperAdmin = computed(() => userStore.info.roles?.includes('R_SUPER') ?? false)
  const searchForm = ref({ category: '', status: '' })
  const appliedFilters = ref({ category: '', status: '' })

  const categories = computed(() => [...new Set(templates.value.map((item) => item.category))])
  const statuses = computed(() => [...new Set(templates.value.map((item) => item.status))])
  const searchItems = computed(() => [
    {
      label: t('templateManagement.category'),
      key: 'category',
      type: 'select',
      props: {
        placeholder: t('templateManagement.allCategories'),
        clearable: true,
        options: categories.value.map((category) => ({ label: category, value: category }))
      }
    },
    {
      label: t('templateManagement.status'),
      key: 'status',
      type: 'select',
      props: {
        placeholder: t('templateManagement.allStatuses'),
        clearable: true,
        options: statuses.value.map((status) => ({ label: statusLabel(status), value: status }))
      }
    }
  ])
  const visibleTemplates = computed(() =>
    templates.value.filter(
      (item) =>
        (!appliedFilters.value.category || item.category === appliedFilters.value.category) &&
        (!appliedFilters.value.status || item.status === appliedFilters.value.status)
    )
  )

  const applySearch = () => {
    appliedFilters.value = { ...searchForm.value }
  }

  const resetSearch = () => {
    appliedFilters.value = { category: '', status: '' }
  }

  const statusLabel = (status: string) =>
    status === 'disabled'
      ? t('templateManagement.statusDisabled')
      : status === 'active'
        ? t('templateManagement.statusActive')
        : status

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))

  const openTemplateDraft = (template: AdminTemplateListItem) =>
    router.push({ name: 'ManagedTemplateEditor', params: { code: template.code } })
  const openTemplateVersions = (template: AdminTemplateListItem) => {
    selectedTemplate.value = template
    versionsVisible.value = true
  }

  const changeAvailability = async (template: AdminTemplateListItem) => {
    if (
      !isSuperAdmin.value ||
      !template.currentVersion ||
      availabilityUpdating.value ||
      !['active', 'disabled'].includes(template.status)
    )
      return
    const disabling = template.status === 'active'
    try {
      await ElMessageBox.confirm(
        t(disabling ? 'templateManagement.disableConfirm' : 'templateManagement.enableConfirm', {
          name: template.name
        }),
        t(disabling ? 'templateManagement.disable' : 'templateManagement.enable'),
        {
          type: 'warning',
          confirmButtonText: t(
            disabling ? 'templateManagement.disable' : 'templateManagement.enable'
          ),
          cancelButtonText: t('templateManagement.cancel')
        }
      )
    } catch {
      return
    }
    availabilityUpdating.value = true
    try {
      await changeManagedAvailability(template.code, {
        status: disabling ? 'disabled' : 'active',
        expectedStatus: disabling ? 'active' : 'disabled',
        expectedCurrentVersion: template.currentVersion
      })
      ElMessage.success(
        t(disabling ? 'templateManagement.disableSuccess' : 'templateManagement.enableSuccess')
      )
      await loadTemplates()
    } catch (error) {
      ElMessage.error(
        error instanceof HttpError && error.code === 409
          ? t('templateManagement.availabilityConflict')
          : t('templateManagement.availabilityFailed')
      )
    } finally {
      availabilityUpdating.value = false
    }
  }

  const loadTemplates = async () => {
    loading.value = true
    error.value = false
    try {
      templates.value = await fetchAdminTemplates()
    } catch {
      templates.value = []
      error.value = true
    } finally {
      loading.value = false
    }
  }

  onMounted(loadTemplates)
</script>
