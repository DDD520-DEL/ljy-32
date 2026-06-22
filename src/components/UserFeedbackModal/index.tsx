import React, { useState, useEffect } from 'react';
import { View, Text, Textarea, Input, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { FeedbackType, FEEDBACK_TYPE_CONFIG } from '../../types';
import { useData } from '../../store/DataContext';

interface UserFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

const getDeviceInfo = (): { phoneModel: string; osInfo: string; appVersion: string } => {
  try {
    const sysInfo = Taro.getSystemInfoSync();
    return {
      phoneModel: sysInfo.model || '未知设备',
      osInfo: `${sysInfo.platform || ''} ${sysInfo.system || ''}`.trim() || '未知系统',
      appVersion: sysInfo.version || '1.0.0'
    };
  } catch (e) {
    console.error('[UserFeedback] getDeviceInfo error:', e);
    return {
      phoneModel: '未知设备',
      osInfo: '未知系统',
      appVersion: '1.0.0'
    };
  }
};

const UserFeedbackModal: React.FC<UserFeedbackModalProps> = ({ visible, onClose }) => {
  const { getCurrentBuilding, addFeedbackRecord } = useData();

  const [feedbackType, setFeedbackType] = useState<FeedbackType>('suggestion');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [showThanks, setShowThanks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({ phoneModel: '', osInfo: '', appVersion: '' });

  useEffect(() => {
    if (visible) {
      setFeedbackType('suggestion');
      setContent('');
      setContact('');
      setShowThanks(false);
      setIsSubmitting(false);
      setDeviceInfo(getDeviceInfo());
    }
  }, [visible]);

  const currentBuilding = getCurrentBuilding();

  const handleSubmit = () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      Taro.showToast({ title: '请输入反馈内容', icon: 'none' });
      return;
    }
    if (trimmedContent.length < 5) {
      Taro.showToast({ title: '反馈内容至少5个字', icon: 'none' });
      return;
    }
    if (trimmedContent.length > 1000) {
      Taro.showToast({ title: '反馈内容不能超过1000字', icon: 'none' });
      return;
    }

    setIsSubmitting(true);

    try {
      addFeedbackRecord({
        type: feedbackType,
        content: trimmedContent,
        contact: contact.trim() || undefined,
        buildingId: currentBuilding?.id,
        buildingName: currentBuilding?.name,
        buildingAddress: currentBuilding?.address,
        phoneModel: deviceInfo.phoneModel,
        osInfo: deviceInfo.osInfo,
        appVersion: deviceInfo.appVersion
      });

      setShowThanks(true);
    } catch (e) {
      console.error('[UserFeedback] submit error:', e);
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThanksClose = () => {
    setShowThanks(false);
    onClose();
  };

  if (!visible) return null;

  if (showThanks) {
    return (
      <View className={styles.mask}>
        <View className={styles.thanksModal}>
          <View className={styles.thanksIcon}>🎉</View>
          <Text className={styles.thanksTitle}>感谢您的反馈！</Text>
          <Text className={styles.thanksDesc}>
            您的建议对我们非常重要，我们会认真处理每一条反馈。
          </Text>
          <Button className={styles.thanksBtn} onClick={handleThanksClose}>
            我知道了
          </Button>
        </View>
      </View>
    );
  }

  const typeList: FeedbackType[] = ['suggestion', 'bug', 'question', 'other'];

  return (
    <View className={styles.mask} onClick={onClose}>
      <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <View className={styles.header}>
          <Text className={styles.title}>意见反馈</Text>
          <Text className={styles.closeBtn} onClick={onClose}>✕</Text>
        </View>

        <ScrollView className={styles.body} scrollY>
          <View className={styles.formItem}>
            <Text className={styles.label}>反馈类型</Text>
            <View className={styles.typeSelector}>
              {typeList.map((type) => {
                const config = FEEDBACK_TYPE_CONFIG[type];
                return (
                  <View
                    key={type}
                    className={classNames(styles.typeOption, { [styles.active]: feedbackType === type })}
                    onClick={() => setFeedbackType(type)}
                  >
                    <Text>{config.icon}</Text>
                    <Text className={styles.typeLabel}>{config.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className={styles.formItem}>
            <Text className={styles.label}>反馈内容 <Text className={styles.required}>*</Text></Text>
            <Textarea
              className={styles.textarea}
              placeholder="请详细描述您遇到的问题或改进建议..."
              value={content}
              onInput={(e) => setContent(e.detail.value)}
              maxlength={1000}
              autoHeight
            />
            <Text className={styles.charCount}>{content.length}/1000</Text>
          </View>

          <View className={styles.formItem}>
            <Text className={styles.label}>联系方式（选填）</Text>
            <Input
              className={styles.input}
              placeholder="方便我们联系您，手机号或邮箱"
              value={contact}
              onInput={(e) => setContact(e.detail.value)}
              maxlength={100}
            />
          </View>

          <View className={styles.metaSection}>
            <Text className={styles.metaTitle}>附带信息（用于排查问题）</Text>
            <View className={styles.metaList}>
              <View className={styles.metaItem}>
                <Text className={styles.metaLabel}>当前楼栋：</Text>
                <Text className={styles.metaValue}>
                  {currentBuilding ? `${currentBuilding.name}（${currentBuilding.address}）` : '未选择楼栋'}
                </Text>
              </View>
              <View className={styles.metaItem}>
                <Text className={styles.metaLabel}>手机型号：</Text>
                <Text className={styles.metaValue}>{deviceInfo.phoneModel}</Text>
              </View>
              <View className={styles.metaItem}>
                <Text className={styles.metaLabel}>系统信息：</Text>
                <Text className={styles.metaValue}>{deviceInfo.osInfo}</Text>
              </View>
              <View className={styles.metaItem}>
                <Text className={styles.metaLabel}>应用版本：</Text>
                <Text className={styles.metaValue}>{deviceInfo.appVersion}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View className={styles.footer}>
          <Button className={styles.cancelBtn} onClick={onClose}>
            取消
          </Button>
          <Button
            className={styles.confirmBtn}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? '提交中...' : '提交反馈'}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default UserFeedbackModal;
