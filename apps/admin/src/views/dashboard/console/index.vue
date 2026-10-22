<template>
  <div class="space-y-4 md:space-y-5">
    <section class="art-card-sm p-5 md:p-6">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="mb-2 text-sm font-medium text-theme">{{ $t('dashboardHome.eyebrow') }}</p>
          <h1 class="text-xl font-semibold text-g-900 md:text-2xl">
            {{ $t('dashboardHome.welcome', { username }) }}
          </h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-g-600">
            {{ $t('dashboardHome.intro') }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3 rounded-lg bg-g-100 px-4 py-3">
          <div
            class="flex size-10 items-center justify-center rounded-full bg-theme/10 text-lg font-semibold text-theme"
          >
            {{ username.slice(0, 1).toUpperCase() }}
          </div>
          <div>
            <p class="text-sm font-medium text-g-900">{{ username }}</p>
            <p class="mt-0.5 text-xs text-g-600">{{ roleLabel }}</p>
          </div>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
      <section class="art-card-sm p-5 md:p-6">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-xl bg-theme/10 text-theme">
            <ArtSvgIcon icon="ri:shield-check-line" class="text-xl" />
          </div>
          <div>
            <h2 class="text-base font-semibold text-g-900">{{
              $t('dashboardHome.availableTitle')
            }}</h2>
            <p class="mt-0.5 text-xs text-g-600">{{ $t('dashboardHome.availableHint') }}</p>
          </div>
        </div>
        <ul class="space-y-3">
          <li
            v-for="item in availableItems"
            :key="item"
            class="flex items-center gap-3 text-sm text-g-800"
          >
            <ArtSvgIcon icon="ri:checkbox-circle-fill" class="text-base text-success" />
            <span>{{ $t(item) }}</span>
          </li>
        </ul>
      </section>

      <section class="art-card-sm p-5 md:p-6">
        <div class="mb-4 flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-xl bg-g-200 text-g-700">
            <ArtSvgIcon icon="ri:time-line" class="text-xl" />
          </div>
          <div>
            <h2 class="text-base font-semibold text-g-900">{{
              $t('dashboardHome.pendingTitle')
            }}</h2>
            <p class="mt-0.5 text-xs text-g-600">{{ $t('dashboardHome.pendingHint') }}</p>
          </div>
        </div>
        <ul class="space-y-3">
          <li
            v-for="item in pendingItems"
            :key="item"
            class="flex items-center gap-3 text-sm text-g-700"
          >
            <ArtSvgIcon icon="ri:circle-line" class="text-base text-g-500" />
            <span>{{ $t(item) }}</span>
          </li>
        </ul>
      </section>
    </div>

    <div class="art-card-sm flex items-start gap-3 px-5 py-4 text-sm leading-6 text-g-700">
      <ArtSvgIcon icon="ri:information-line" class="mt-0.5 shrink-0 text-lg text-theme" />
      <span>{{ $t('dashboardHome.exampleNotice') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useUserStore } from '@/store/modules/user'
  import { useI18n } from 'vue-i18n'

  defineOptions({ name: 'Console' })

  const userStore = useUserStore()
  const { t } = useI18n()
  const username = computed(() => userStore.getUserInfo.userName || '—')
  const roleLabel = computed(() => {
    const role = userStore.getUserInfo.roles?.[0]
    if (role === 'R_SUPER') return t('dashboardHome.superAdmin')
    if (role === 'R_ADMIN') return t('dashboardHome.operator')
    return t('dashboardHome.unknownRole')
  })

  const availableItems = [
    'dashboardHome.passwordLogin',
    'dashboardHome.totpLogin',
    'dashboardHome.sessionRestore',
    'dashboardHome.logout',
    'dashboardHome.templateList'
  ]
  const pendingItems = [
    'dashboardHome.templateManagement',
    'dashboardHome.userAndOrderManagement',
    'dashboardHome.operationMetrics'
  ]
</script>
