'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useTranslation, useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase';
import {
  bootstrapSystemAdmin,
  checkPendingPasswordChange,
  setPasswordWithAccessCode,
  MIN_PASSWORD_LENGTH,
  type BootstrapAdminReason,
  type SetPasswordReason,
  type SignInReason,
} from '@/lib/auth';
import {
  getUserById,
  setMustChangePassword,
  SYSTEM_ADMIN_ID,
  SYSTEM_ADMIN_EMAIL,
} from '@/lib/firestore';
import { recordActivity } from '@/lib/activity-log';
import { logger } from '@/lib/logger';
import { User } from '@/types';
import { CableMark } from '@/components/shared/CableMark';
import { Eye, EyeOff, Lock, User as UserIcon, AlertCircle, Loader2, Check, ShieldAlert, Mail, KeyRound } from 'lucide-react';

// رمز خطأ Firebase يصل على كائن عادي وليس على صنف مشتق من Error
const errorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return '';
};

export default function LoginPage() {
  const router = useRouter();
  const { t, isRTL } = useTranslation();
  const { language, setLanguage } = useLanguage();
  // loginWithResult تعيد سبب الفشل (وليس مجرد false) حتى تُعرض رسالة مطابقة للحالة
  const { loginWithResult, isAuthenticated, currentUser, isLoading: isAuthLoading } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // إعادة تعيين كلمة المرور ذاتياً عبر بريد Firebase - المسار الوحيد للاسترجاع
  // بعد التخلي عن كلمات المرور القديمة
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  // خطوة اختيار كلمة المرور عند أول دخول - إلزامية.
  //
  // الموظف الجديد يدخل برمز وصول لمرة واحدة سلّمه له مسؤول النظام مباشرة، وما دام
  // mustChangePassword مضبوطاً على وثيقته فإن checkPendingPasswordChange ترفض فتح أي
  // جلسة له. لذلك ليس هنا "مستخدم مسجّل دخوله ينتظر"، بل مستخدم تم التحقق من رمزه فقط
  // ولم تُفتح له جلسة بعد - وهذا بالضبط ما يمنعه من الوصول إلى بقية النظام.
  //
  // pendingSecret هو ما كتبه في حقل كلمة المرور: رمز الوصول في المرة الأولى، أو كلمة
  // مروره الحالية إن كان قد غيّرها ثم أُغلقت النافذة قبل مسح العلامة. في الحالتين هو
  // بيانات الاعتماد التي ستُستخدم لإعادة المصادقة قبل تعيين كلمة المرور الجديدة.
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pendingSecret, setPendingSecret] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [onboardError, setOnboardError] = useState('');
  const [isOnboarding, setIsOnboarding] = useState(false);

  // الإعداد الأولي لمرة واحدة لحساب مدير النظام
  const [needsSetup, setNeedsSetup] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);

  // إذا كان المستخدم مسجل دخوله، انتقل للوحة التحكم.
  // يُستثنى وقت الإعداد الأولي: إنشاء حساب مدير النظام يجري كاملاً على نسخة Firebase
  // ثانوية فلا يُفترض أن يمس الجلسة الحالية، ويبقى الاستثناء احتياطاً حتى لا ينتقل
  // المشغّل إلى لوحة التحكم في منتصف الإعداد.
  // يُستثنى كذلك وقت خطوة كلمة المرور الإجبارية: لا جلسة مفتوحة أثناءها أصلاً، لكن
  // الاستثناء يبقى صريحاً حتى لا ينتقل الموظف إلى لوحة التحكم في منتصف الخطوة.
  useEffect(() => {
    if (isAuthenticated && currentUser && !isSettingUp && !pendingUser) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, currentUser, isSettingUp, pendingUser, router]);

  // فحص التشغيل الأول: قراءة واحدة فقط لوثيقة مدير النظام.
  //
  // هي القراءة الوحيدة التي تسمح بها القواعد لزائر غير مسجّل دخوله، وهي مسموحة
  // ما دامت الوثيقة بلا authUid - أي ما دام الإعداد الأولي لم يكتمل. فور كتابة
  // authUid (آخر خطوة في bootstrapSystemAdmin) تُمنع هذه القراءة نفسها، فتعيد
  // getUserById القيمة null وتختفي اللوحة إلى الأبد. لذلك لا فرق هنا بين "الوثيقة
  // غير موجودة" و"مُنعت القراءة": كلاهما يعني ألا تُعرض اللوحة - إما لأن النظام
  // مُعدّ فعلاً، أو لأننا لا نعرف، وعرض اللوحة على غير يقين يمنح أي زائر حساب
  // مدير النظام. أما المشغّل الذي ينتظر اللوحة فسيراها لأن قراءته ستنجح.
  //
  // لم تعد هناك أي قراءة لمجموعة passwords: القواعد تمنعها، ولم تعد دليلاً على شيء.
  //
  // setupSuccess يوقف الفحص نهائياً في هذه الجلسة حتى لا تعود اللوحة للظهور بعد نجاح
  // الإعداد.
  useEffect(() => {
    if (isAuthLoading || isAuthenticated || setupSuccess) return;

    let cancelled = false;
    const checkFirstRun = async () => {
      const admin = await getUserById(SYSTEM_ADMIN_ID);
      if (cancelled) return;

      setAdminUser(admin);

      const authUid = (admin as (User & { authUid?: string }) | null)?.authUid;
      setNeedsSetup(admin !== null && !authUid);
    };

    checkFirstRun();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, isAuthenticated, setupSuccess]);

  // رسالة صريحة لكل سبب فشل في الإعداد الأولي. هذا المسار هو الطريق الوحيد لدخول
  // المالك، فلا يُقال عن أي فشل فيه إنه "خطأ ما".
  const describeBootstrapReason = (reason: BootstrapAdminReason): string => {
    switch (reason) {
      case 'account_exists':
        return isRTL
          ? 'حساب مدير النظام موجود بالفعل. سجّل الدخول به، وإن نسيت كلمة المرور فاستخدم رابط إعادة التعيين.'
          : 'The system administrator account already exists. Sign in with it, or use the reset link if you forgot the password.';
      case 'not_linked':
        return isRTL
          ? 'تعذّرت كتابة صلاحية الحساب، فأُلغي الحساب ولم يتغيّر شيء. تأكد من نشر قواعد Firestore ثم أعد المحاولة - هذه اللوحة ما زالت صالحة.'
          : 'The account authorization could not be written, so the account was removed again and nothing changed. Make sure the Firestore rules are deployed, then try again - this panel is still usable.';
      case 'weak_password':
        return isRTL
          ? `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`
          : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
      case 'auth_not_enabled':
        return isRTL
          ? 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في مشروع Firebase'
          : 'Email/password sign-in is not enabled in the Firebase project';
      case 'auth_not_configured':
        return isRTL
          ? 'إعدادات الاتصال بـ Firebase غير مكتملة أو غير صحيحة'
          : 'The Firebase connection settings are missing or incorrect';
      case 'too_many_requests':
        return isRTL
          ? 'تم إيقاف المحاولات مؤقتاً بعد عدد كبير من الطلبات. انتظر قليلاً ثم أعد المحاولة.'
          : 'Requests are temporarily blocked after too many attempts. Wait a moment and try again.';
      case 'network_error':
        return isRTL
          ? 'تعذر الوصول إلى الخادم. تحقق من اتصالك بالشبكة ثم أعد المحاولة.'
          : 'Could not reach the server. Check your network connection and try again.';
      default:
        return isRTL
          ? 'فشل في إنشاء حساب مدير النظام'
          : 'Failed to create the system administrator account';
    }
  };

  // إنشاء حساب مدير النظام لأول مرة: حساب Firebase Auth، ثم وثيقة الصلاحية
  // authUsers/{uid}، ثم حقل authUid على وثيقة مدير النظام - بهذا الترتيب، وكلها في
  // bootstrapSystemAdmin حتى يكون التراجع عن أي فشل داخل عملية واحدة.
  // لم نعد نكتب في مجموعة passwords القديمة: مصدر الحقيقة الآن هو Firebase Auth.
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    if (!setupPassword || !setupConfirmPassword) {
      setSetupError(isRTL ? 'جميع الحقول مطلوبة' : 'All fields are required');
      return;
    }

    if (setupPassword !== setupConfirmPassword) {
      setSetupError(isRTL ? 'كلمة المرور الجديدة غير متطابقة' : 'New passwords do not match');
      return;
    }

    if (setupPassword.length < MIN_PASSWORD_LENGTH) {
      setSetupError(
        isRTL
          ? `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`
          : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
      return;
    }

    if (!adminUser) {
      setSetupError(isRTL ? 'تعذر قراءة حساب مدير النظام' : 'Could not read the system administrator account');
      return;
    }

    setIsSettingUp(true);

    try {
      const result = await bootstrapSystemAdmin(adminUser, SYSTEM_ADMIN_EMAIL, setupPassword);

      if (result.ok) {
        setSetupPassword('');
        setSetupConfirmPassword('');
        setNeedsSetup(false);
        setSetupSuccess(true);
        // تعبئة اسم المستخدم ببريد مدير النظام حتى لا يضطر المشغّل لتذكره
        setUsername(SYSTEM_ADMIN_EMAIL);
        return;
      }

      setSetupError(describeBootstrapReason(result.reason));

      // الحساب موجود أصلاً: الإعداد الأولي انتهى (ربما في جهاز آخر)، فتُخفى اللوحة
      // ويُوجَّه المشغّل إلى نموذج الدخول. أما بقية الأسباب فالإعداد ما زال ممكناً،
      // ولا يصح إخفاء اللوحة عنها.
      if (result.reason === 'account_exists') {
        setNeedsSetup(false);
        setUsername(SYSTEM_ADMIN_EMAIL);
      }
    } catch (err) {
      // bootstrapSystemAdmin لا ترمي، لكن الفشل هنا هو الطريق الوحيد لدخول المالك
      // فلا يُترك دون رسالة
      console.error('Error bootstrapping the system administrator account:', err);
      setSetupError(describeBootstrapReason('error'));
    } finally {
      setIsSettingUp(false);
    }
  };

  // رسالة موحّدة لكل سبب فشل يعيده تسجيل الدخول
  const describeReason = (reason: SignInReason): string => {
    switch (reason) {
      case 'inactive':
        return isRTL
          ? 'هذا الحساب معطّل. يرجى التواصل مع إدارة الجودة.'
          : 'This account is disabled. Please contact the quality department.';
      case 'invalid_credentials':
        return isRTL ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password';
      case 'account_exists':
        return isRTL
          ? 'لهذا البريد حساب دخول بالفعل، وكلمة المرور القديمة لم تعد صالحة. سجّل الدخول بكلمة المرور الحالية أو استخدم رابط إعادة التعيين.'
          : 'A sign-in account already exists for this email and the old password is no longer valid. Sign in with your current password, or use the reset link.';
      case 'not_linked':
        return isRTL
          ? 'تم التحقق من الحساب لكنه غير مربوط بسجل موظف فعّال، فلن يتمكن من قراءة أي بيانات. تواصل مع مدير النظام لربط الحساب.'
          : 'The account was authenticated but is not linked to an active employee record, so it cannot read any data. Contact the system administrator to link it.';
      case 'auth_not_enabled':
        return isRTL
          ? 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل في مشروع Firebase. هذه مشكلة إعداد تخص النظام كله - أبلغ مدير النظام.'
          : 'Email/password sign-in is not enabled in the Firebase project. This is a system-wide configuration problem - report it to the system administrator.';
      case 'auth_not_configured':
        return isRTL
          ? 'إعدادات الاتصال بـ Firebase غير مكتملة أو غير صحيحة. هذه مشكلة إعداد تخص النظام كله - أبلغ مدير النظام.'
          : 'The Firebase connection settings are missing or incorrect. This is a system-wide configuration problem - report it to the system administrator.';
      case 'too_many_requests':
        return isRTL
          ? 'تم إيقاف المحاولات مؤقتاً بعد عدد كبير من المحاولات الفاشلة. انتظر قليلاً ثم أعد المحاولة.'
          : 'Sign-in attempts are temporarily blocked after too many failed tries. Wait a moment and try again.';
      case 'network_error':
        return isRTL
          ? 'تعذر الوصول إلى الخادم. تحقق من اتصالك بالشبكة ثم أعد المحاولة.'
          : 'Could not reach the server. Check your network connection and try again.';
      case 'service_unavailable':
        // بيانات الدخول صحيحة والحساب سليم - تعذّرت قراءة الصلاحيات فقط. الرسالة
        // العامة كانت تحوّل عطلاً مؤقتاً إلى شك في الحساب، وهو بالضبط ما أُضيف هذا
        // السبب لمنعه.
        return isRTL
          ? 'تم قبول بيانات الدخول، لكن تعذّر الوصول إلى بيانات الصلاحيات في هذه اللحظة. المشكلة مؤقتة في الاتصال ولا علاقة لها بحسابك - أعد المحاولة بعد قليل.'
          : 'Your credentials were accepted, but your permissions could not be read just now. This is a temporary connection problem, not a problem with your account - please try again in a moment.';
      default:
        return isRTL ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred during login';
    }
  };

  // وصف قصير للسبب يُكتب داخل جملة سجل النشاط - بلغتين، وبلا أي ذكر لكلمة المرور
  const describeReasonForLog = (reason: SignInReason): { ar: string; en: string } => {
    switch (reason) {
      case 'invalid_credentials':
        return {
          ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
          en: 'the email address or the password was rejected',
        };
      case 'inactive':
        return { ar: 'الحساب معطّل', en: 'the account is disabled' };
      case 'not_linked':
        return {
          ar: 'الحساب غير مربوط بسجل موظف فعّال',
          en: 'the account is not linked to an active employee record',
        };
      case 'service_unavailable':
        return {
          ar: 'تعذّرت قراءة صلاحيات الحساب في تلك اللحظة',
          en: 'the account permissions could not be read at that moment',
        };
      default:
        return { ar: `تعذّر إكمال الدخول (${reason})`, en: `sign-in could not be completed (${reason})` };
    }
  };

  // تسجيل محاولة دخول فاشلة.
  //
  // البريد المُدخل فقط - لا كلمة المرور ولا أي جزء منها، ولا حتى طولها.
  // ملاحظة تشغيلية: قواعد Firestore المنشورة تسمح بالكتابة في activityLog للمستخدم
  // الفعّال وحده، ومحاولة الدخول الفاشلة بطبيعتها غير مصادَق عليها، فهذا القيد سيُرفض
  // على الخادم ويُبتلع بصمت (recordActivity لا ترمي أبداً). المحاولات الفاشلة تبقى
  // مسجّلة في وحدة تحكم Firebase Authentication. الاستدعاء مكتوب هنا حتى يعمل فوراً
  // إن سُمح لاحقاً بكتابة هذا النوع من القيود.
  const recordFailedSignIn = (attemptedEmail: string, reason: SignInReason) => {
    const detail = describeReasonForLog(reason);
    const shownAr = attemptedEmail || 'بريد غير مُدخل';
    const shownEn = attemptedEmail || 'no email entered';

    void recordActivity({
      actorUserId: '',
      actorName: shownEn,
      actorEmail: attemptedEmail,
      actorRole: '',
      action: 'login_failed',
      entity: 'session',
      entityLabel: shownEn,
      summaryEn: `A sign-in attempt for the email address ${shownEn} was refused because ${detail.en}. The password used in the attempt is deliberately not recorded.`,
      summaryAr: `رُفضت محاولة تسجيل دخول بالبريد الإلكتروني ${shownAr} لأن ${detail.ar}. لا تُسجَّل كلمة المرور المستخدمة في المحاولة إطلاقاً.`,
    });
  };

  // تسجيل الدخول على خطوتين.
  //
  // الخطوة الأولى (checkPendingPasswordChange) تتحقق من بيانات الاعتماد على نسخة Firebase
  // الثانوية وتقرأ ما إذا كان الموظف ما زال مديناً بكلمة مرور خاصة به. من يدين بها لا
  // تُفتح له جلسة إطلاقاً - يُنقل إلى خطوة اختيار كلمة المرور - فلا توجد لحظة واحدة
  // يكون فيها داخل النظام برمز وصول.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage('');
    setResetError('');
    setIsLoading(true);

    const attemptedEmail = username.trim().toLowerCase();

    try {
      const check = await checkPendingPasswordChange(username, password);

      if (check.status === 'refused') {
        setError(describeReason(check.reason));
        recordFailedSignIn(attemptedEmail, check.reason);
        return;
      }

      if (check.status === 'required') {
        setPendingUser(check.user);
        setPendingSecret(password);
        setPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setOnboardError('');
        return;
      }

      const result = await loginWithResult(username, password);
      if (result.ok) {
        router.push('/dashboard');
      } else {
        setError(describeReason(result.reason));
        recordFailedSignIn(attemptedEmail, result.reason);
      }
    } catch {
      setError(isRTL ? 'حدث خطأ أثناء تسجيل الدخول' : 'An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  // رسالة صريحة لكل سبب فشل في تعيين كلمة مرور أول دخول
  const describeSetPasswordReason = (reason: SetPasswordReason): string => {
    switch (reason) {
      case 'invalid_credentials':
        return isRTL
          ? 'رمز الوصول لم يعد صالحاً. اطلب رمزاً جديداً من إدارة الجودة ثم أعد المحاولة.'
          : 'The access code is no longer valid. Ask the quality department for a new one and try again.';
      case 'password_too_short':
        return isRTL
          ? `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`
          : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
      case 'same_as_code':
        return isRTL
          ? 'لا يمكن أن تكون كلمة مرورك هي نفس رمز الوصول الذي دخلت به. اختر كلمة مرور يعرفها أنت وحدك.'
          : 'Your password cannot be the access code you signed in with. Choose one that only you know.';
      case 'inactive':
        return isRTL
          ? 'هذا الحساب معطّل. يرجى التواصل مع إدارة الجودة.'
          : 'This account is disabled. Please contact the quality department.';
      case 'too_many_requests':
        return isRTL
          ? 'تم إيقاف المحاولات مؤقتاً بعد عدد كبير من الطلبات. انتظر قليلاً ثم أعد المحاولة.'
          : 'Requests are temporarily blocked after too many attempts. Wait a moment and try again.';
      case 'network_error':
        return isRTL
          ? 'تعذر الوصول إلى الخادم. تحقق من اتصالك بالشبكة ثم أعد المحاولة.'
          : 'Could not reach the server. Check your network connection and try again.';
      case 'auth_not_enabled':
      case 'auth_not_configured':
        return isRTL
          ? 'إعدادات المصادقة في المشروع غير مكتملة. أبلغ مدير النظام.'
          : 'The project authentication settings are incomplete. Report this to the system administrator.';
      default:
        return isRTL ? 'تعذّر حفظ كلمة المرور الجديدة' : 'The new password could not be saved';
    }
  };

  // إنهاء أول دخول: رمز الوصول يُستبدل بكلمة مرور يختارها الموظف.
  //
  // الترتيب مقصود ولا يجوز عكسه:
  //   1. تُغيَّر كلمة المرور على نسخة Firebase الثانوية - الرمز يتوقف عن العمل هنا،
  //   2. تُفتح الجلسة الحقيقية بكلمة المرور الجديدة (بلا فحص مسبق: نحن من عيّنها للتو،
  //      والعلامة ما زالت مضبوطة فلو مررنا بالفحص لعُدنا إلى هذه الخطوة نفسها)،
  //   3. تُمسح العلامة من وثيقة المستخدم - وهي كتابة لا تسمح بها القواعد إلا لجلسة
  //      الموظف نفسه، ولهذا جاءت بعد فتح الجلسة لا قبلها.
  // من أغلق النافذة في المنتصف: العلامة ما زالت مضبوطة، فالدخول التالي يعيده إلى هذه
  // الخطوة نفسها - لكن ببيانات اعتماده الجديدة، لأن الرمز القديم لم يعد يفتح شيئاً.
  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError('');

    if (!pendingUser) return;

    if (!newPassword || !confirmNewPassword) {
      setOnboardError(isRTL ? 'جميع الحقول مطلوبة' : 'All fields are required');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setOnboardError(isRTL ? 'كلمة المرور الجديدة غير متطابقة' : 'New passwords do not match');
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setOnboardError(
        isRTL
          ? `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`
          : `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
      return;
    }

    if (newPassword === pendingSecret) {
      setOnboardError(describeSetPasswordReason('same_as_code'));
      return;
    }

    setIsOnboarding(true);

    try {
      const changed = await setPasswordWithAccessCode(pendingUser.email, pendingSecret, newPassword);

      if (!changed.ok) {
        setOnboardError(describeSetPasswordReason(changed.reason));
        return;
      }

      const result = await loginWithResult(pendingUser.email, newPassword);

      if (!result.ok) {
        // كلمة المرور تغيّرت فعلاً - الجلسة وحدها هي التي لم تُفتح. نعيده إلى نموذج
        // الدخول ببريده معبأً، ونقول له صراحة أن كلمة المرور الجديدة هي الصالحة الآن
        // حتى لا يعود إلى رمز الوصول الذي لم يعد يعمل.
        setPendingUser(null);
        setPendingSecret('');
        setUsername(pendingUser.email);
        setPassword('');
        setError(
          (isRTL
            ? 'تم حفظ كلمة المرور الجديدة، لكن تعذّر فتح الجلسة. سجّل الدخول بكلمة المرور الجديدة. '
            : 'Your new password was saved, but the session could not be opened. Sign in with your new password. ') +
            describeReason(result.reason)
        );
        return;
      }

      const cleared = await setMustChangePassword(result.user.id, false);

      if (!cleared) {
        // كلمة المرور صارت ملكه والجلسة مفتوحة، لكن الوثيقة ما زالت تقول إنه مدين
        // بتغيير - فسيُطلب منه ذلك في كل دخول لاحق. لا نحبسه هنا: الهدف الأمني تحقق،
        // والقيد أدناه يُبلغ مدير النظام بما جرى.
        logger.warn(
          'The password was changed but mustChangePassword could not be cleared for user:',
          result.user.id
        );
      }

      void recordActivity({
        actorUserId: result.user.id,
        actorName: result.user.fullNameEn || result.user.fullNameAr,
        actorEmail: result.user.email,
        actorRole: result.user.role,
        action: 'password_change',
        entity: 'user',
        entityId: result.user.id,
        entityLabel: result.user.fullNameEn || result.user.fullNameAr,
        summaryEn:
          `${result.user.fullNameEn} (${result.user.email}) replaced the one-time access code with a password of their own at first sign-in` +
          (cleared
            ? ', and the account is now fully onboarded.'
            : ', but the onboarding flag on their user document could not be cleared, so the system will ask for a password change again at the next sign-in.'),
        summaryAr:
          `استبدل ${result.user.fullNameAr} (${result.user.email}) رمز الوصول لمرة واحدة بكلمة مرور خاصة به عند أول تسجيل دخول` +
          (cleared
            ? '، واكتملت تهيئة الحساب.'
            : '، لكن تعذّر مسح علامة التهيئة من وثيقة المستخدم، فسيُطلب منه تغيير كلمة المرور مرة أخرى في الدخول التالي.'),
      });

      setPendingUser(null);
      setPendingSecret('');
      setNewPassword('');
      setConfirmNewPassword('');
      router.push('/dashboard');
    } catch (err) {
      logger.error('Error completing the first sign-in password change:', err);
      setOnboardError(describeSetPasswordReason('error'));
    } finally {
      setIsOnboarding(false);
    }
  };

  // العودة إلى نموذج الدخول من خطوة كلمة المرور - لا جلسة تُغلق لأنه لم تُفتح أصلاً
  const cancelOnboarding = () => {
    setPendingUser(null);
    setPendingSecret('');
    setNewPassword('');
    setConfirmNewPassword('');
    setOnboardError('');
    setPassword('');
  };

  // إرسال رابط إعادة تعيين كلمة المرور إلى البريد المكتوب في حقل اسم المستخدم
  const handlePasswordReset = async () => {
    setError('');
    setResetError('');
    setResetMessage('');

    const email = username.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setResetError(
        isRTL
          ? 'اكتب بريدك الإلكتروني في حقل اسم المستخدم أولاً'
          : 'Enter your email address in the username field first'
      );
      return;
    }

    setIsSendingReset(true);

    // رسالة محايدة لا تكشف ما إذا كان البريد مسجلاً في النظام - وهي نفس سياسة
    // Firebase عند تفعيل الحماية من تعداد الحسابات
    const neutralMessage = isRTL
      ? 'إذا كان هناك حساب مرتبط بهذا البريد فقد أُرسل إليه رابط إعادة تعيين كلمة المرور. تحقق من بريدك ومن مجلد الرسائل غير المرغوب فيها.'
      : 'If an account exists for this email, a password reset link has been sent to it. Check your inbox and your spam folder.';

    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage(neutralMessage);
    } catch (err) {
      const code = errorCode(err);

      if (code === 'auth/user-not-found') {
        // نفس الرسالة المحايدة: لا نكشف الحسابات غير الموجودة
        setResetMessage(neutralMessage);
      } else if (code === 'auth/invalid-email') {
        setResetError(isRTL ? 'صيغة البريد الإلكتروني غير صحيحة' : 'The email address is not valid');
      } else if (code === 'auth/too-many-requests') {
        setResetError(
          isRTL
            ? 'تم إرسال عدد كبير من الطلبات. حاول مرة أخرى بعد قليل.'
            : 'Too many requests. Please try again in a moment.'
        );
      } else {
        setResetError(
          isRTL ? 'تعذر إرسال رابط إعادة التعيين' : 'Could not send the password reset link'
        );
      }
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Language Switcher */}
      <div className="absolute top-4 end-4 z-20">
        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--card-bg)]/80 backdrop-blur border border-[var(--border)] text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--background-tertiary)] transition-colors"
        >
          {language === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>

      {/* ── Brand panel ───────────────────────────────────────────────
          A cable in cross-section: the company's own product as the mark.
          Hidden on small screens so the form gets the whole viewport. */}
      <aside className="qms-brand-panel relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white">
        {/* Oversized mark bled off the edge, as a watermark */}
        <div
          className="pointer-events-none absolute -bottom-24 opacity-[0.07]"
          style={{ [isRTL ? 'left' : 'right']: '-6rem' }}
          aria-hidden="true"
        >
          <CableMark size={620} />
        </div>

        <div className="relative qms-rise qms-rise-1">
          <CableMark size={72} />
        </div>

        <div className="relative max-w-lg">
          <h1 className="qms-rise qms-rise-2 text-4xl font-bold leading-tight tracking-tight">
            {t('common.appName')}
          </h1>
          <p className="qms-rise qms-rise-3 mt-4 text-lg text-white/70">
            {isRTL
              ? 'إدارة دورة المراجعة الداخلية للجودة كاملة.'
              : 'The complete internal quality audit lifecycle.'}
          </p>

          <div className="qms-rise qms-rise-4 mt-10 flex items-center gap-3">
            <span className="h-px w-10 bg-[var(--primary)]" />
            <span className="text-sm font-medium tracking-wide text-[var(--primary)]">
              ISO 9001:2015
            </span>
          </div>
        </div>

        <p className="relative text-sm text-white/50">
          {t('common.companyName')}
        </p>
      </aside>

      {/* ── Form panel ─────────────────────────────────────────────── */}
      <main className="flex items-center justify-center bg-[var(--background)] px-6 py-12">
        <div className="w-full max-w-md">
          {/* Compact brand lockup, shown only where the panel is hidden */}
          <div className="qms-rise qms-rise-1 mb-8 flex flex-col items-center text-center lg:hidden">
            <CableMark size={64} />
            <h1 className="mt-4 text-xl font-bold text-[var(--foreground)]">
              {t('common.companyName')}
            </h1>
            <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
              {t('common.appName')}
            </p>
          </div>

        {pendingUser ? (
          /* ── خطوة اختيار كلمة المرور عند أول دخول ─────────────────────
             تحلّ محل نموذج الدخول بالكامل: الموظف تحقق من رمزه لكن لا جلسة له،
             فلا يوجد شيء آخر يستطيع فعله في النظام قبل أن يختار كلمة مروره. */
          <div className="qms-rise qms-rise-2 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-xl p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[var(--primary)]" />
              <h2 className="text-2xl font-bold text-[var(--foreground)]">
                {isRTL ? 'اختر كلمة مرورك' : 'Choose your password'}
              </h2>
            </div>
            <p className="mt-1.5 text-sm text-[var(--foreground-secondary)]">
              {isRTL
                ? 'دخلت برمز وصول لمرة واحدة. اختر الآن كلمة مرور تخصك وحدك لإكمال الدخول - لن تتمكن من استخدام النظام قبل ذلك.'
                : 'You signed in with a one-time access code. Choose a password that only you know to finish signing in - you cannot use the system until you do.'}
            </p>

            {/* لمن هذا الحساب - حتى لا يضبط أحدهم كلمة مرور لحساب غير حسابه */}
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {isRTL ? pendingUser.fullNameAr : pendingUser.fullNameEn}
              </p>
              <p className="mt-0.5 text-sm text-[var(--foreground-secondary)] break-all" dir="ltr">
                {pendingUser.email}
              </p>
            </div>

            <form onSubmit={handleOnboardSubmit} className="mt-5 space-y-5">
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  {isRTL ? 'كلمة المرور الجديدة' : 'New password'}
                </label>
                <div className="relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-[var(--foreground-secondary)]`}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={isRTL ? 'أدخل كلمة المرور الجديدة' : 'Enter the new password'}
                    className={`w-full ${isRTL ? 'pr-10 pl-12' : 'pl-10 pr-12'} py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all`}
                    required
                    autoFocus
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'} text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors`}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--foreground-secondary)]">
                  {isRTL
                    ? `${MIN_PASSWORD_LENGTH} أحرف على الأقل، ويجب أن تختلف عن رمز الوصول الذي دخلت به.`
                    : `At least ${MIN_PASSWORD_LENGTH} characters, and different from the access code you signed in with.`}
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  {isRTL ? 'تأكيد كلمة المرور' : 'Confirm password'}
                </label>
                <div className="relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-[var(--foreground-secondary)]`}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder={isRTL ? 'أعد إدخال كلمة المرور' : 'Re-enter the password'}
                    className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all`}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {onboardError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                  <span className="text-sm text-red-600 dark:text-red-400">{onboardError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isOnboarding || !newPassword || !confirmNewPassword}
                className="qms-sheen relative overflow-hidden w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white font-medium transition-all hover:shadow-lg hover:shadow-[var(--primary)]/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
              >
                {isOnboarding ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isRTL ? 'جاري الحفظ...' : 'Saving...'}
                  </>
                ) : (
                  isRTL ? 'حفظ كلمة المرور والمتابعة' : 'Save password and continue'
                )}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={cancelOnboarding}
                disabled={isOnboarding}
                className="w-full text-sm text-[var(--foreground-secondary)] hover:text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRTL ? 'الرجوع إلى تسجيل الدخول' : 'Back to sign in'}
              </button>
              <p className="mt-4 text-center text-xs text-[var(--foreground-secondary)]">
                {isRTL
                  ? 'إن أغلقت هذه الصفحة قبل الحفظ، فسيطلب منك النظام اختيار كلمة المرور مرة أخرى عند الدخول التالي.'
                  : 'If you close this page before saving, the system will ask you to choose a password again at your next sign-in.'}
              </p>
            </div>
          </div>
        ) : (
        <>
        {needsSetup && (
          /* First-Run Administrator Setup - لوحة إضافية تظهر فوق نموذج تسجيل الدخول
             فقط عندما لا توجد بيانات اعتماد لحساب مدير النظام */
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {isRTL ? 'إعداد مدير النظام لأول مرة' : 'First-Run Administrator Setup'}
              </h2>
            </div>

            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 mb-5">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {isRTL
                  ? 'هذا إعداد لمرة واحدة: لم يتم إنشاء حساب دخول لمدير النظام بعد. أي شخص يصل إلى هذه الشاشة الآن يستطيع إنشاؤه والحصول على أعلى صلاحية في النظام، فأكمل هذه الخطوة بنفسك قبل مشاركة الرابط مع أحد.'
                  : 'This is a one-time setup: no sign-in account has been created for the system administrator yet. Anyone who reaches this screen right now can create it and gain the highest privilege in the system, so complete this step yourself before sharing the link with anyone.'}
              </p>
            </div>

            {/* بريد مدير النظام - يُعرض لأنه هو اسم المستخدم الذي سيُسجَّل الدخول به */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 mb-5">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-[var(--foreground-secondary)]" />
                <span className="text-sm font-medium text-[var(--foreground)]">
                  {isRTL ? 'بريد مدير النظام' : 'System administrator email'}
                </span>
              </div>
              <p className="text-sm text-[var(--foreground-secondary)] break-all" dir="ltr">
                {SYSTEM_ADMIN_EMAIL}
              </p>
              <p className="text-xs text-[var(--foreground-secondary)] mt-2">
                {isRTL
                  ? 'سيُنشأ الحساب بهذا البريد، وهو نفسه ما تدخله في حقل اسم المستخدم لاحقاً.'
                  : 'The account will be created with this email, and this is what you enter in the username field afterwards.'}
              </p>
            </div>

            <form onSubmit={handleSetupSubmit} className="space-y-5">
              {/* New Password Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  {isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
                </label>
                <div className="relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-[var(--foreground-secondary)]`}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder={isRTL ? 'أدخل كلمة المرور الجديدة' : 'Enter the new password'}
                    className={`w-full ${isRTL ? 'pr-10 pl-12' : 'pl-10 pr-12'} py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all`}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'} text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors`}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                  {isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-[var(--foreground-secondary)]`}>
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={setupConfirmPassword}
                    onChange={(e) => setSetupConfirmPassword(e.target.value)}
                    placeholder={isRTL ? 'أعد إدخال كلمة المرور' : 'Re-enter the password'}
                    className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all`}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Error Message */}
              {setupError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm text-red-600 dark:text-red-400">{setupError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSettingUp || !setupPassword || !setupConfirmPassword}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white font-medium transition-all hover:shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSettingUp ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isRTL ? 'جاري الإنشاء...' : 'Creating...'}
                  </>
                ) : (
                  isRTL ? 'إنشاء حساب مدير النظام' : 'Create Administrator Account'
                )}
              </button>
            </form>

            {/* Help Text */}
            <p className="text-center text-sm text-[var(--foreground-secondary)] mt-6">
              {isRTL
                ? 'بعد الإنشاء يمكنك تسجيل الدخول بحساب مدير النظام، ولن تظهر هذه الشاشة مرة أخرى.'
                : 'After creating it you can sign in with the system administrator account, and this screen will not appear again.'}
            </p>
          </div>
        )}


        <div className="qms-rise qms-rise-2 bg-[var(--card-bg)] rounded-2xl border border-[var(--border)] shadow-xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-[var(--foreground)]">
            {isRTL ? 'تسجيل الدخول' : 'Sign in'}
          </h2>
          <p className="mt-1.5 mb-6 text-sm text-[var(--foreground-secondary)]">
            {isRTL
              ? 'أدخل بيانات حسابك للمتابعة إلى لوحة التحكم.'
              : 'Enter your credentials to continue to the dashboard.'}
          </p>

          {/* رسالة نجاح الإعداد الأولي */}
          {setupSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-5">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-green-600 dark:text-green-400">
                {isRTL
                  ? 'تم إنشاء حساب مدير النظام. يمكنك تسجيل الدخول الآن بالبريد المعبأ أدناه.'
                  : 'The system administrator account has been created. You can sign in now with the email filled in below.'}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {isRTL ? 'اسم المستخدم' : 'Username'}
              </label>
              <div className="relative">
                <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-[var(--foreground-secondary)]`}>
                  <UserIcon className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isRTL ? 'أدخل اسم المستخدم أو البريد الإلكتروني' : 'Enter username or email'}
                  className={`w-full ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all`}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                {isRTL ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'} text-[var(--foreground-secondary)]`}>
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRTL ? 'أدخل كلمة المرور' : 'Enter password'}
                  className={`w-full ${isRTL ? 'pr-10 pl-12' : 'pl-10 pr-12'} py-3 rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--foreground-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all`}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-3' : 'right-3'} text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors`}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !username || !password}
              className="qms-sheen relative overflow-hidden w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white font-medium transition-all hover:shadow-lg hover:shadow-[var(--primary)]/25 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isRTL ? 'جاري تسجيل الدخول...' : 'Signing in...'}
                </>
              ) : (
                isRTL ? 'تسجيل الدخول' : 'Sign In'
              )}
            </button>
          </form>

          {/* Forgot Password - إعادة تعيين ذاتية عبر البريد */}
          <div className="mt-5 pt-5 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={isSendingReset}
              className="w-full flex items-center justify-center gap-2 text-sm text-[var(--primary)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline transition-colors"
            >
              {isSendingReset ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isRTL ? 'جاري الإرسال...' : 'Sending...'}
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot your password?'}
                </>
              )}
            </button>

            {resetMessage && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mt-4">
                <Check className="h-5 w-5 shrink-0 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">{resetMessage}</span>
              </div>
            )}

            {resetError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mt-4">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">{resetError}</span>
              </div>
            )}
          </div>

          {/* Help Text */}
          <p className="text-center text-sm text-[var(--foreground-secondary)] mt-6">
            {isRTL
              ? 'يُرسل رابط إعادة التعيين إلى البريد المكتوب في حقل اسم المستخدم. إذا تعذر عليك الوصول لبريدك، تواصل مع إدارة الجودة.'
              : 'The reset link is sent to the email entered in the username field. If you cannot access your email, contact the quality department.'}
          </p>
        </div>
        </>
        )}

          {/* Footer */}
          <p className="text-center text-xs text-[var(--foreground-secondary)] mt-6">
            © {new Date().getFullYear()} {t('common.companyName')} — QMS
          </p>
        </div>
      </main>
    </div>
  );
}
