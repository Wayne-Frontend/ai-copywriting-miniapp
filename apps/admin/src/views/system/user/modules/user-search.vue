<template>
  <ArtSearchBar
    v-model="formData"
    :items="formItems"
    @reset="emit('reset')"
    @search="emit('search', $event)"
  />
</template>

<script setup lang="ts">
  const props = defineProps<{ modelValue: Api.SystemManage.UserSearchParams }>()
  const emit = defineEmits<{
    (e: 'update:modelValue', value: Api.SystemManage.UserSearchParams): void
    (e: 'search', value: Api.SystemManage.UserSearchParams): void
    (e: 'reset'): void
  }>()
  const formData = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })
  const formItems = [
    { label: '账号', key: 'userName', type: 'input', placeholder: '搜索账号', clearable: true },
    {
      label: '手机号',
      key: 'userPhone',
      type: 'input',
      placeholder: '搜索手机号',
      clearable: true
    },
    { label: '邮箱', key: 'userEmail', type: 'input', placeholder: '搜索邮箱', clearable: true },
    {
      label: '角色',
      key: 'role',
      type: 'select',
      props: {
        placeholder: '全部角色',
        clearable: true,
        options: [
          { label: '超级管理员', value: 'super_admin' },
          { label: '运营员', value: 'operator' }
        ]
      }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: {
        placeholder: '全部状态',
        clearable: true,
        options: [
          { label: '待绑定 MFA', value: 'pending_mfa' },
          { label: '启用', value: 'active' },
          { label: '停用', value: 'disabled' }
        ]
      }
    }
  ]
</script>
