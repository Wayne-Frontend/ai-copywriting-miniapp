<template>
  <div class="user-page art-full-height">
    <UserSearch v-model="searchForm" @search="handleSearch" @reset="handleReset" />
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left
          ><ElButton type="primary" @click="showDialog('add')">新增管理员</ElButton></template
        >
      </ArtTableHeader>
      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
      <UserDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :user-data="currentUser"
        :submitting="saving"
        @submit="handleDialogSubmit"
      />
    </ElCard>
    <ElDialog v-model="mfaVisible" title="绑定验证器" width="min(520px, 94vw)" destroy-on-close>
      <ElAlert
        type="warning"
        :closable="false"
        show-icon
        title="请现在保存或扫描下方二维码。关闭后无法再次查看，只能重新生成 MFA。"
      />
      <div v-if="mfaUri" class="mfa-content">
        <QrcodeVue :value="mfaUri" :size="180" level="M" />
        <ElInput :model-value="mfaUri" readonly type="textarea" :rows="3" />
        <ElInput
          v-model="mfaCode"
          maxlength="6"
          inputmode="numeric"
          placeholder="输入验证器当前 6 位验证码"
        />
      </div>
      <template #footer>
        <ElButton @click="closeMfa">稍后绑定</ElButton>
        <ElButton type="primary" :loading="saving" @click="confirmMfa">验证并启用</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { h } from 'vue'
  import { ElButton, ElImage, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import QrcodeVue from 'qrcode.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useUserStore } from '@/store/modules/user'
  import {
    fetchAdminUserList,
    createAdminUser,
    updateAdminProfile,
    changeAdminAccess,
    resetAdminPassword,
    resetAdminMfa,
    confirmAdminMfa,
    type AdminRole,
    type AdminUserListItem
  } from '@/api/admin-users'
  import UserSearch from './modules/user-search.vue'
  import UserDialog from './modules/user-dialog.vue'
  import type { UserDialogValue } from './modules/user-dialog.vue'

  defineOptions({ name: 'User' })
  const userStore = useUserStore()
  const searchForm = ref<Api.SystemManage.UserSearchParams>({})
  const dialogType = ref<'add' | 'edit'>('add')
  const dialogVisible = ref(false)
  const currentUser = ref<AdminUserListItem>()
  const saving = ref(false)
  const mfaVisible = ref(false)
  const mfaUserId = ref('')
  const mfaUri = ref('')
  const mfaCode = ref('')
  const roles: Record<AdminRole, string> = { super_admin: '超级管理员', operator: '运营员' }
  const statuses: Record<string, { label: string; type: 'warning' | 'success' | 'info' }> = {
    pending_mfa: { label: '待绑定 MFA', type: 'warning' as const },
    active: { label: '启用', type: 'success' as const },
    disabled: { label: '停用', type: 'info' as const }
  }
  const showError = (error: unknown) =>
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  const showDialog = (type: 'add' | 'edit', row?: AdminUserListItem) => {
    dialogType.value = type
    currentUser.value = row
    dialogVisible.value = true
  }
  const withAction = async (action: () => Promise<unknown>, success: string) => {
    try {
      saving.value = true
      await action()
      ElMessage.success(success)
      await refreshData()
      return true
    } catch (error) {
      showError(error)
      return false
    } finally {
      saving.value = false
    }
  }
  const handleDialogSubmit = async (value: UserDialogValue) => {
    if (dialogType.value === 'add') {
      await withAction(async () => {
        const result = await createAdminUser(value)
        dialogVisible.value = false
        mfaUserId.value = result.user.id
        mfaUri.value = result.mfaUri
        mfaCode.value = ''
        mfaVisible.value = true
      }, '账号已创建，请绑定 MFA 后启用')
    } else if (currentUser.value) {
      await withAction(async () => {
        await updateAdminProfile(currentUser.value!.id, value.profile)
        dialogVisible.value = false
      }, '资料已保存')
    }
  }
  const changeAccess = async (
    row: AdminUserListItem,
    role: AdminRole,
    status: 'active' | 'disabled'
  ) => {
    if (row.role === role && row.status === status) return
    const operation =
      row.status !== status
        ? status === 'disabled'
          ? '停用'
          : '启用'
        : role === 'super_admin'
          ? '设为超级管理员'
          : '降为运营员'
    try {
      await ElMessageBox.confirm(
        `确定${operation}「${row.userName}」吗？权限变更会撤销该账号现有会话。`,
        '确认账户变更',
        { type: 'warning' }
      )
      await withAction(() => changeAdminAccess(row.id, role, status), '账户权限已更新')
    } catch {
      /* 用户取消确认，无需提示 */
    }
  }
  const resetPassword = async (row: AdminUserListItem) => {
    try {
      const { value } = await ElMessageBox.prompt(
        '请输入至少 12 位的新密码',
        `重置「${row.userName}」密码`,
        {
          inputType: 'password',
          inputValidator: (input) => input.length >= 12 || '密码至少 12 位'
        }
      )
      await ElMessageBox.confirm('重置后该账号的现有会话会全部退出。确定继续？', '确认重置密码', {
        type: 'warning'
      })
      const reset = await withAction(() => resetAdminPassword(row.id, value), '密码已重置')
      if (reset && row.id === userStore.getUserInfo.userId) userStore.logOut()
    } catch {
      /* 用户取消确认，无需提示 */
    }
  }
  const resetMfa = async (row: AdminUserListItem) => {
    try {
      await ElMessageBox.confirm(
        `重新生成「${row.userName}」的 MFA 后，旧验证器立即失效，现有会话全部退出。新验证码验证通过后账号会启用。`,
        '确认重置 MFA',
        { type: 'warning' }
      )
      await withAction(async () => {
        const result = await resetAdminMfa(row.id)
        mfaUserId.value = row.id
        mfaUri.value = result.mfaUri
        mfaCode.value = ''
        mfaVisible.value = true
      }, '请扫描新的验证器二维码')
    } catch {
      /* 用户取消确认，无需提示 */
    }
  }
  const closeMfa = () => {
    mfaVisible.value = false
    mfaUri.value = ''
    mfaCode.value = ''
  }
  const confirmMfa = async () => {
    if (!/^\d{6}$/.test(mfaCode.value)) {
      ElMessage.warning('请输入 6 位验证码')
      return
    }
    await withAction(async () => {
      await confirmAdminMfa(mfaUserId.value, mfaCode.value)
      closeMfa()
    }, 'MFA 已绑定，账号已启用')
  }
  const actions = (row: AdminUserListItem) =>
    h('div', { class: 'user-actions' }, [
      h(
        ElButton,
        { type: 'primary', link: true, onClick: () => showDialog('edit', row) },
        () => '编辑'
      ),
      row.status !== 'pending_mfa'
        ? h(
            ElButton,
            {
              type: 'primary',
              link: true,
              onClick: () =>
                changeAccess(
                  row,
                  row.role === 'operator' ? 'super_admin' : 'operator',
                  row.status as 'active' | 'disabled'
                )
            },
            () => (row.role === 'operator' ? '升为超管' : '降为运营')
          )
        : null,
      row.status !== 'pending_mfa'
        ? h(
            ElButton,
            {
              type: row.status === 'active' ? 'danger' : 'success',
              link: true,
              onClick: () =>
                changeAccess(row, row.role, row.status === 'active' ? 'disabled' : 'active')
            },
            () => (row.status === 'active' ? '停用' : '启用')
          )
        : null,
      h(ElButton, { link: true, onClick: () => resetPassword(row) }, () => '重置密码'),
      h(ElButton, { link: true, onClick: () => resetMfa(row) }, () =>
        row.status === 'pending_mfa' ? '重生成 MFA' : '重置 MFA'
      )
    ])
  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    searchParams,
    getData,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: fetchAdminUserList,
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
        {
          prop: 'userName',
          label: '账号 / 昵称',
          minWidth: 240,
          formatter: (row) =>
            h('div', { class: 'user-identity' }, [
              h(ElImage, { src: row.avatar, class: 'user-avatar' }),
              h('div', [h('strong', row.userName), h('small', row.nickName || '未填写昵称')])
            ])
        },
        {
          prop: 'userGender',
          label: '性别',
          width: 80,
          formatter: (row) => ({ male: '男', female: '女', other: '其他' })[row.userGender] || '—'
        },
        {
          prop: 'userPhone',
          label: '手机号',
          minWidth: 140,
          formatter: (row) => row.userPhone || '—'
        },
        {
          prop: 'userEmail',
          label: '邮箱',
          minWidth: 200,
          formatter: (row) => row.userEmail || '—'
        },
        { prop: 'role', label: '角色', minWidth: 110, formatter: (row) => roles[row.role] },
        {
          prop: 'status',
          label: '状态',
          minWidth: 145,
          formatter: (row) =>
            h('div', [
              h(
                ElTag,
                { type: statuses[row.status]?.type || 'info' },
                () => statuses[row.status]?.label || row.status
              ),
              row.online
                ? h(ElTag, { type: 'success', effect: 'plain', class: 'online-tag' }, () => '在线')
                : null
            ])
        },
        {
          prop: 'createTime',
          label: '创建信息',
          minWidth: 190,
          formatter: (row) =>
            h('div', [
              h('span', new Date(row.createTime).toLocaleString('zh-CN')),
              h('small', `创建人：${row.createBy || '—'}`)
            ])
        },
        {
          prop: 'updateTime',
          label: '更新信息',
          minWidth: 190,
          formatter: (row) =>
            h('div', [
              h('span', new Date(row.updateTime).toLocaleString('zh-CN')),
              h('small', `更新人：${row.updateBy || '—'}`)
            ])
        },
        { prop: 'operation', label: '操作', width: 390, fixed: 'right', formatter: actions }
      ]
    }
  })
  const handleSearch = (params: Api.SystemManage.UserSearchParams) => {
    // 清除上次筛选中这次未提交的字段，避免“清空条件”后仍带旧过滤值。
    for (const key of ['userName', 'userPhone', 'userEmail', 'role', 'status'] as const) {
      delete searchParams[key]
    }
    Object.assign(searchParams, params)
    getData()
  }
  const handleReset = () => {
    searchForm.value = {}
    resetSearchParams()
  }
</script>

<style scoped>
  .user-page :deep(.user-identity) {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .user-page :deep(.user-avatar) {
    width: 36px;
    height: 36px;
    flex: none;
    border-radius: 8px;
  }
  .user-page :deep(small) {
    display: block;
    color: var(--el-text-color-secondary);
  }
  .user-page :deep(.user-actions) {
    display: flex;
    align-items: center;
    white-space: nowrap;
  }
  .user-page :deep(.user-actions .el-button + .el-button) {
    margin-left: 8px;
  }
  .user-page :deep(.online-tag) {
    margin-left: 4px;
  }
  .mfa-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    margin-top: 20px;
  }
</style>
