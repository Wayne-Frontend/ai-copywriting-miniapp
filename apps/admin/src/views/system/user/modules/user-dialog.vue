<template>
  <ElDialog
    v-model="dialogVisible"
    :title="type === 'add' ? '新增管理员' : '编辑管理员资料'"
    width="min(760px, 94vw)"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="form" :rules="rules" label-position="top" class="user-form">
      <ElFormItem label="账号" prop="username">
        <ElInput v-model="form.username" :disabled="type === 'edit'" maxlength="80" />
      </ElFormItem>
      <ElFormItem v-if="type === 'add'" label="初始密码" prop="password">
        <ElInput
          v-model="form.password"
          type="password"
          show-password
          autocomplete="new-password"
          placeholder="至少 12 位；创建后请安全地告知本人"
        />
      </ElFormItem>
      <ElFormItem v-if="type === 'add'" label="角色" prop="role">
        <ElSelect v-model="form.role">
          <ElOption label="超级管理员" value="super_admin" />
          <ElOption label="运营员" value="operator" />
        </ElSelect>
      </ElFormItem>
      <div class="form-grid">
        <ElFormItem label="昵称"><ElInput v-model="form.nickname" maxlength="80" /></ElFormItem>
        <ElFormItem label="姓名"><ElInput v-model="form.realName" maxlength="80" /></ElFormItem>
        <ElFormItem label="性别">
          <ElSelect v-model="form.gender" clearable placeholder="未填写">
            <ElOption label="男" value="male" /><ElOption label="女" value="female" />
            <ElOption label="其他" value="other" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="部门"><ElInput v-model="form.department" maxlength="80" /></ElFormItem>
        <ElFormItem label="手机号" prop="phone"
          ><ElInput v-model="form.phone" maxlength="20"
        /></ElFormItem>
        <ElFormItem label="邮箱" prop="email"
          ><ElInput v-model="form.email" maxlength="254"
        /></ElFormItem>
      </div>
      <ElFormItem label="头像">
        <div class="avatar-list">
          <button
            v-for="key in avatarKeys"
            :key="key"
            type="button"
            class="avatar-option"
            :class="{ selected: form.avatarKey === key }"
            @click="form.avatarKey = key"
          >
            <img :src="adminAvatar(key)" :alt="key" />
          </button>
          <ElButton text @click="form.avatarKey = ''">使用默认头像</ElButton>
        </div>
      </ElFormItem>
      <ElFormItem label="地址"><ElInput v-model="form.address" maxlength="200" /></ElFormItem>
      <ElFormItem label="简介"
        ><ElInput v-model="form.bio" type="textarea" :rows="3" maxlength="500" show-word-limit
      /></ElFormItem>
    </ElForm>
    <template #footer>
      <ElButton @click="dialogVisible = false">取消</ElButton>
      <ElButton type="primary" :loading="submitting" @click="handleSubmit">保存</ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { adminAvatar, avatarKeys } from '@/utils/admin-avatar'
  import type { AdminProfile, AdminRole, AdminUserListItem } from '@/api/admin-users'

  export interface UserDialogValue {
    username: string
    password: string
    role: AdminRole
    profile: AdminProfile
  }
  const props = defineProps<{
    visible: boolean
    type: 'add' | 'edit'
    userData?: Partial<AdminUserListItem>
    submitting?: boolean
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'submit', value: UserDialogValue): void
  }>()
  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })
  const formRef = ref<FormInstance>()
  const form = reactive({
    username: '',
    password: '',
    role: 'operator' as AdminRole,
    nickname: '',
    realName: '',
    gender: '',
    phone: '',
    email: '',
    department: '',
    avatarKey: '',
    address: '',
    bio: ''
  })
  const rules: FormRules = {
    username: [
      {
        required: true,
        pattern: /^[a-z0-9_.-]{3,80}$/,
        message: '账号需为 3-80 位小写字母、数字、点、下划线或横线'
      }
    ],
    password: [
      {
        validator: (_rule, value: string, done: (error?: Error) => void) =>
          props.type !== 'add' || (value.length >= 12 && value.length <= 1024)
            ? done()
            : done(new Error('初始密码至少 12 位'))
      }
    ],
    phone: [
      {
        validator: (_rule, value: string, done: (error?: Error) => void) =>
          !value || /^1[3-9]\d{9}$/.test(value) ? done() : done(new Error('手机号格式不正确'))
      }
    ],
    email: [{ type: 'email', message: '邮箱格式不正确' }]
  }
  watch(
    () => props.visible,
    (visible) => {
      if (!visible) return
      const row = props.userData
      Object.assign(form, {
        username: props.type === 'edit' ? (row?.userName ?? '') : '',
        password: '',
        role: props.type === 'edit' ? (row?.role ?? 'operator') : 'operator',
        nickname: row?.nickName ?? '',
        realName: row?.realName ?? '',
        gender: row?.userGender ?? '',
        phone: row?.userPhone ?? '',
        email: row?.userEmail ?? '',
        department: row?.department ?? '',
        avatarKey: row?.avatarKey ?? '',
        address: row?.address ?? '',
        bio: row?.bio ?? ''
      })
      nextTick(() => formRef.value?.clearValidate())
    }
  )
  const handleSubmit = async () => {
    if (!(await formRef.value?.validate().catch(() => false))) return
    // 空白资料与数据库 NULL 对齐，旧账号迁移后不制造虚假的个人信息。
    const profile = Object.fromEntries(
      (
        [
          'nickname',
          'realName',
          'gender',
          'phone',
          'email',
          'department',
          'avatarKey',
          'address',
          'bio'
        ] as const
      ).map((key) => [key, form[key].trim() || null])
    ) as unknown as AdminProfile
    emit('submit', {
      username: form.username.trim(),
      password: form.password,
      role: form.role,
      profile
    })
  }
</script>

<style scoped>
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 18px;
  }
  .avatar-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .avatar-option {
    border: 2px solid transparent;
    border-radius: 50%;
    padding: 2px;
    cursor: pointer;
  }
  .avatar-option.selected {
    border-color: var(--el-color-primary);
  }
  .avatar-option img {
    display: block;
    width: 36px;
    height: 36px;
    border-radius: 50%;
  }
  @media (max-width: 600px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
