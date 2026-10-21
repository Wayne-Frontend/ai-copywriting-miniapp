<template>
  <div class="template-page art-full-height">
    <ArtSearchBar
      v-model="searchForm"
      :items="searchItems"
      :button-left-limit="0"
      @search="applySearch"
      @reset="resetSearch"
    />

    <ElCard class="art-table-card">
      <ArtTableHeader
        :loading="loading"
        layout="refresh,size,fullscreen,settings"
        @refresh="loadTemplates"
      >
        <template #left>
          <div class="flex items-center gap-2">
            <span class="font-medium text-g-900">{{ $t('templateManagement.listTitle') }}</span>
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
        <ElTableColumn prop="name" :label="$t('templateManagement.name')" min-width="215">
          <template #default="{ row }">
            <p class="font-medium text-g-900" :title="row.description">{{ row.name }}</p>
            <p class="mt-1 font-mono text-xs text-g-500">{{ row.code }}</p>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="category" :label="$t('templateManagement.category')" min-width="90">
          <template #default="{ row }">
            <ElTag type="info" effect="plain">{{ row.category }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('templateManagement.status')" min-width="95">
          <template #default="{ row }">
            <ElTag type="info" round>{{ statusLabel(row.status) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('templateManagement.version')" min-width="90">
          <template #default="{ row }">{{ row.currentVersion ?? '—' }}</template>
        </ElTableColumn>
        <ElTableColumn :label="$t('templateManagement.updatedAt')" min-width="170">
          <template #default="{ row }">
            <p>{{ formatDate(row.updatedAt) }}</p>
            <p class="mt-1 text-xs text-g-500">
              {{ $t('templateManagement.updatedBy') }}：{{ row.updatedByUsername ?? '—' }}
            </p>
          </template>
        </ElTableColumn>
        <ElTableColumn :label="$t('templateManagement.actions')" width="108" fixed="right">
          <template #default="{ row }">
            <ElTooltip
              v-if="row.code === 'XHS_TITLE'"
              :content="$t('templateManagement.editDraft')"
            >
              <ArtButtonTable
                type="edit"
                role="button"
                tabindex="0"
                :aria-label="$t('templateManagement.editDraft')"
                @click="openXhsTitleDraft"
                @keydown.enter="openXhsTitleDraft"
                @keydown.space.prevent="openXhsTitleDraft"
              />
            </ElTooltip>
            <span v-else class="text-g-400">—</span>
          </template>
        </ElTableColumn>
      </ArtTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { fetchAdminTemplates, type AdminTemplateListItem } from '@/api/templates'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'TemplateList' })

  const { locale, t } = useI18n()
  const router = useRouter()
  const templates = ref<AdminTemplateListItem[]>([])
  const loading = ref(false)
  const error = ref(false)
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
    status === 'disabled' ? t('templateManagement.statusDisabled') : status

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value))

  const openXhsTitleDraft = () => router.push({ name: 'XhsTitleDraft' })

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
