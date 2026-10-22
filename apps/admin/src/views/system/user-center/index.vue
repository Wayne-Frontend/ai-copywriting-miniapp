<!-- 个人中心沿用 Art Design Pro 原有封面、左侧资料卡与右侧设置卡布局。 -->
<template>
  <div class="w-full h-full p-0 bg-transparent border-none shadow-none">
    <div class="relative flex-b mt-2.5 max-md:block max-md:mt-1">
      <div class="w-112 mr-5 max-md:w-full max-md:mr-0">
        <div class="art-card-sm relative p-9 pb-8 overflow-hidden text-center">
          <img
            class="absolute top-0 left-0 w-full h-50 object-cover"
            src="@imgs/user/bg.webp"
            alt=""
          />
          <img
            class="relative z-10 w-20 h-20 mt-30 mx-auto object-cover border-2 border-white rounded-full"
            :src="adminAvatar(profile.avatarKey)"
            alt="管理员头像"
          />
          <h2 class="mt-5 text-xl font-normal">{{
            profile.nickname || account.username || '管理员'
          }}</h2>
          <p class="mt-5 text-sm text-g-600">{{ profile.bio || '暂无个人介绍' }}</p>

          <div class="w-75 max-w-full mx-auto mt-7.5 text-left profile-details">
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:mail-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ profile.email || '未填写邮箱' }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:user-3-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{
                account.role === 'super_admin' ? '超级管理员' : '运营员'
              }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:map-pin-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ profile.address || '未填写地址' }}</span>
            </div>
            <div class="mt-2.5">
              <ArtSvgIcon icon="ri:building-line" class="text-g-700" />
              <span class="ml-2 text-sm">{{ profile.department || '未填写部门' }}</span>
            </div>
          </div>

          <div class="mt-10">
            <ElTag :type="account.status === 'active' ? 'success' : 'warning'" effect="plain">
              {{ account.status === 'active' ? '已启用' : '待绑定 MFA' }}
            </ElTag>
            <p class="mt-3 text-xs text-g-500">账号：{{ account.username || '—' }}</p>
          </div>
        </div>
      </div>

      <div class="flex-1 min-w-0 overflow-hidden max-md:w-full max-md:mt-3.5">
        <div class="art-card-sm">
          <h1 class="p-4 text-xl font-normal border-b border-g-300">基本设置</h1>
          <ElForm
            ref="profileFormRef"
            :model="profile"
            :rules="profileRules"
            class="box-border p-5 profile-form"
            label-position="top"
          >
            <ElRow :gutter="20">
              <ElCol :xs="24" :sm="12">
                <ElFormItem label="姓名"
                  ><ElInput v-model="profile.realName" :disabled="!isEdit" maxlength="80"
                /></ElFormItem>
              </ElCol>
              <ElCol :xs="24" :sm="12">
                <ElFormItem label="性别">
                  <ElSelect
                    v-model="profile.gender"
                    :disabled="!isEdit"
                    clearable
                    placeholder="未填写"
                  >
                    <ElOption label="男" value="male" />
                    <ElOption label="女" value="female" />
                    <ElOption label="其他" value="other" />
                  </ElSelect>
                </ElFormItem>
              </ElCol>
            </ElRow>
            <ElRow :gutter="20">
              <ElCol :xs="24" :sm="12">
                <ElFormItem label="昵称"
                  ><ElInput v-model="profile.nickname" :disabled="!isEdit" maxlength="80"
                /></ElFormItem>
              </ElCol>
              <ElCol :xs="24" :sm="12">
                <ElFormItem label="邮箱" prop="email"
                  ><ElInput v-model="profile.email" :disabled="!isEdit" maxlength="254"
                /></ElFormItem>
              </ElCol>
            </ElRow>
            <ElRow :gutter="20">
              <ElCol :xs="24" :sm="12">
                <ElFormItem label="手机" prop="phone"
                  ><ElInput v-model="profile.phone" :disabled="!isEdit" maxlength="20"
                /></ElFormItem>
              </ElCol>
              <ElCol :xs="24" :sm="12">
                <ElFormItem label="地址"
                  ><ElInput v-model="profile.address" :disabled="!isEdit" maxlength="200"
                /></ElFormItem>
              </ElCol>
            </ElRow>
            <ElFormItem label="个人介绍">
              <ElInput
                v-model="profile.bio"
                type="textarea"
                :rows="4"
                :disabled="!isEdit"
                maxlength="500"
                show-word-limit
              />
            </ElFormItem>
            <template v-if="isEdit">
              <ElFormItem label="部门"
                ><ElInput v-model="profile.department" maxlength="80"
              /></ElFormItem>
              <ElFormItem label="头像">
                <div class="avatar-list">
                  <button
                    v-for="key in avatarKeys"
                    :key="key"
                    type="button"
                    class="avatar-option"
                    :class="{ selected: profile.avatarKey === key }"
                    :aria-label="`选择头像 ${key.replace('avatar', '')}`"
                    :aria-pressed="profile.avatarKey === key"
                    @click="profile.avatarKey = key"
                  >
                    <img :src="adminAvatar(key)" alt="" />
                  </button>
                  <ElButton text @click="profile.avatarKey = ''">使用默认头像</ElButton>
                </div>
              </ElFormItem>
            </template>
            <div class="flex-c justify-end gap-2 [&_.el-button]:!w-27.5">
              <ElButton v-if="isEdit" @click="cancelEdit">取消</ElButton>
              <ElButton
                type="primary"
                :disabled="!loaded"
                :loading="savingProfile"
                v-ripple
                @click="editProfile"
              >
                {{ isEdit ? '保存' : '编辑' }}
              </ElButton>
            </div>
          </ElForm>
        </div>

        <div class="art-card-sm my-5">
          <h1 class="p-4 text-xl font-normal border-b border-g-300">更改密码</h1>
          <ElForm
            ref="passwordFormRef"
            :model="passwordForm"
            :rules="passwordRules"
            class="box-border p-5"
            label-position="top"
          >
            <ElFormItem label="当前密码" prop="oldPassword">
              <ElInput
                v-model="passwordForm.oldPassword"
                type="password"
                :disabled="!isEditPwd"
                show-password
                autocomplete="current-password"
              />
            </ElFormItem>
            <ElFormItem label="新密码" prop="newPassword">
              <ElInput
                v-model="passwordForm.newPassword"
                type="password"
                :disabled="!isEditPwd"
                show-password
                autocomplete="new-password"
              />
            </ElFormItem>
            <ElFormItem label="确认新密码" prop="confirmPassword">
              <ElInput
                v-model="passwordForm.confirmPassword"
                type="password"
                :disabled="!isEditPwd"
                show-password
                autocomplete="new-password"
              />
            </ElFormItem>
            <ElFormItem label="验证器当前 6 位验证码" prop="totp">
              <ElInput
                v-model="passwordForm.totp"
                :disabled="!isEditPwd"
                maxlength="6"
                inputmode="numeric"
                autocomplete="one-time-code"
              />
            </ElFormItem>
            <p class="mb-4 text-xs text-g-500"
              >修改成功后，管理端会话将退出，请使用新密码重新登录。</p
            >
            <div class="flex-c justify-end gap-2 [&_.el-button]:!w-27.5">
              <ElButton v-if="isEditPwd" @click="cancelPasswordEdit">取消</ElButton>
              <ElButton type="primary" :loading="savingPassword" v-ripple @click="editPassword">
                {{ isEditPwd ? '保存' : '编辑' }}
              </ElButton>
            </div>
          </ElForm>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
  import { useUserStore } from '@/store/modules/user'
  import { adminAvatar, avatarKeys } from '@/utils/admin-avatar'
  import {
    fetchMyAdminProfile,
    updateMyAdminProfile,
    changeMyAdminPassword,
    type AdminProfile,
    type AdminUserRecord
  } from '@/api/admin-users'
  import { fetchGetUserInfo } from '@/api/auth'

  defineOptions({ name: 'UserCenter' })
  const userStore = useUserStore()
  const account = reactive({ username: '', role: 'operator', status: 'active' })
  const profile = reactive({
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
  const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '', totp: '' })
  const profileFormRef = ref<FormInstance>()
  const passwordFormRef = ref<FormInstance>()
  const savingProfile = ref(false)
  const savingPassword = ref(false)
  const loaded = ref(false)
  const isEdit = ref(false)
  const isEditPwd = ref(false)
  let savedProfile = { ...profile }

  const profileRules: FormRules = {
    phone: [
      {
        validator: (_rule, value: string, done: (error?: Error) => void) =>
          !value || /^1[3-9]\d{9}$/.test(value) ? done() : done(new Error('手机号格式不正确'))
      }
    ],
    email: [{ type: 'email', message: '邮箱格式不正确' }]
  }
  const passwordRules: FormRules = {
    oldPassword: [{ required: true, message: '请输入当前密码' }],
    newPassword: [{ min: 12, max: 1024, required: true, message: '新密码至少 12 位' }],
    confirmPassword: [
      {
        validator: (_rule, value: string, done: (error?: Error) => void) =>
          value === passwordForm.newPassword ? done() : done(new Error('两次密码不一致'))
      }
    ],
    totp: [{ pattern: /^\d{6}$/, required: true, message: '请输入 6 位验证码' }]
  }
  const applyRecord = (record: AdminUserRecord) => {
    account.username = record.username
    account.role = record.role
    account.status = record.status
    for (const key of Object.keys(profile) as (keyof typeof profile)[]) {
      profile[key] = record[key] ?? ''
    }
    savedProfile = { ...profile }
  }
  onMounted(async () => {
    try {
      applyRecord(await fetchMyAdminProfile())
      loaded.value = true
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '资料加载失败')
    }
  })
  const normalizedProfile = () =>
    Object.fromEntries(
      (Object.keys(profile) as (keyof typeof profile)[]).map((key) => [
        key,
        profile[key].trim() || null
      ])
    ) as unknown as AdminProfile
  const cancelEdit = () => {
    Object.assign(profile, savedProfile)
    profileFormRef.value?.clearValidate()
    isEdit.value = false
  }
  const editProfile = async () => {
    if (!isEdit.value) {
      isEdit.value = true
      return
    }
    if (!(await profileFormRef.value?.validate().catch(() => false))) return
    savingProfile.value = true
    try {
      applyRecord(await updateMyAdminProfile(normalizedProfile()))
      userStore.setUserInfo(await fetchGetUserInfo())
      isEdit.value = false
      ElMessage.success('资料已保存')
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存失败')
    } finally {
      savingProfile.value = false
    }
  }
  const cancelPasswordEdit = () => {
    Object.assign(passwordForm, { oldPassword: '', newPassword: '', confirmPassword: '', totp: '' })
    passwordFormRef.value?.clearValidate()
    isEditPwd.value = false
  }
  const editPassword = async () => {
    if (!isEditPwd.value) {
      isEditPwd.value = true
      return
    }
    if (!(await passwordFormRef.value?.validate().catch(() => false))) return
    try {
      await ElMessageBox.confirm('密码修改后当前会话会退出。确定继续？', '确认修改密码', {
        type: 'warning'
      })
    } catch {
      return
    }
    savingPassword.value = true
    try {
      await changeMyAdminPassword(
        passwordForm.oldPassword,
        passwordForm.newPassword,
        passwordForm.totp
      )
      ElMessage.success('密码已修改，请重新登录')
      userStore.logOut()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '修改失败')
    } finally {
      savingPassword.value = false
    }
  }
</script>

<style scoped>
  .profile-details > div {
    display: flex;
    align-items: flex-start;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .profile-details .art-svg-icon {
    flex: none;
    margin-top: 2px;
  }
  .profile-form :deep(.el-col .el-form-item) {
    width: 100%;
  }
  .profile-form :deep(.el-col .el-input),
  .profile-form :deep(.el-col .el-select) {
    width: 100%;
  }
  .avatar-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .avatar-option {
    padding: 2px;
    border: 2px solid transparent;
    border-radius: 50%;
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
</style>
