export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false
  return EMAIL_REGEX.test(email.trim())
}

export const validatePasswordStrength = (password = '') => {
  const hasMinLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password)
  const isValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial

  return {
    hasMinLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isValid,
  }
}
