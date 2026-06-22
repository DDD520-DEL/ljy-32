import React, { useState, useEffect } from 'react';
import { View, Text, Textarea, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { PropertyFeedback, ComplaintStatus, COMPLAINT_STATUS_CONFIG } from '../../types';

interface FeedbackModalProps {
  visible: boolean;
  initialFeedback?: PropertyFeedback;
  initialStatus?: ComplaintStatus;
  onClose: () => void;
  onSubmit: (feedback: PropertyFeedback, status: ComplaintStatus) => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  initialFeedback,
  initialStatus = 'replied',
  onClose,
  onSubmit
}) => {
  const [replyContent, setReplyContent] = useState('');
  const [attitudeScore, setAttitudeScore] = useState(5);
  const [speedScore, setSpeedScore] = useState(5);
  const [status, setStatus] = useState<ComplaintStatus>('replied');

  useEffect(() => {
    if (visible) {
      setReplyContent(initialFeedback?.replyContent || '');
      setAttitudeScore(initialFeedback?.attitudeScore || 5);
      setSpeedScore(initialFeedback?.speedScore || 5);
      setStatus(initialStatus);
    }
  }, [visible, initialFeedback, initialStatus]);

  const overallScore = Math.round((attitudeScore + speedScore) / 2);

  const handleSubmit = () => {
    if (!replyContent.trim()) {
      Taro.showToast({ title: '请输入物业回复内容', icon: 'none' });
      return;
    }

    const feedback: PropertyFeedback = {
      replyContent: replyContent.trim(),
      replyTime: new Date().toISOString(),
      attitudeScore,
      speedScore,
      overallScore
    };

    onSubmit(feedback, status);
    onClose();
  };

  const renderStars = (score: number, onChange: (val: number) => void) => {
    return (
      <View className={styles.stars}>
        {[1, 2, 3, 4, 5].map((val) => (
          <Text
            key={val}
            className={classNames(styles.star, { [styles.active]: val <= score })}
            onClick={() => onChange(val)}
          >
            ★
          </Text>
        ))}
      </View>
    );
  };

  if (!visible) return null;

  const statusList: ComplaintStatus[] = ['pending', 'replied', 'processing', 'resolved'];

  return (
    <View className={styles.mask} onClick={onClose}>
      <View className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <View className={styles.header}>
          <Text className={styles.title}>补充物业反馈</Text>
          <Text className={styles.closeBtn} onClick={onClose}>✕</Text>
        </View>

        <View className={styles.body}>
          <View className={styles.formItem}>
            <Text className={styles.label}>处理状态</Text>
            <View className={styles.statusSelector}>
              {statusList.map((s) => {
                const config = COMPLAINT_STATUS_CONFIG[s];
                return (
                  <View
                    key={s}
                    className={classNames(styles.statusOption, { [styles.active]: status === s })}
                    onClick={() => setStatus(s)}
                  >
                    <Text>{config.icon} {config.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View className={styles.formItem}>
            <Text className={styles.label}>物业回复内容</Text>
            <Textarea
              className={styles.textarea}
              placeholder="请输入物业的回复内容..."
              value={replyContent}
              onInput={(e) => setReplyContent(e.detail.value)}
              maxlength={500}
            />
          </View>

          <View className={styles.ratingSection}>
            <Text className={styles.label}>服务评价</Text>

            <View className={styles.ratingItem}>
              <Text className={styles.ratingLabel}>处理态度</Text>
              {renderStars(attitudeScore, setAttitudeScore)}
              <Text className={styles.scoreDisplay}>{attitudeScore}分</Text>
            </View>

            <View className={styles.ratingItem}>
              <Text className={styles.ratingLabel}>响应速度</Text>
              {renderStars(speedScore, setSpeedScore)}
              <Text className={styles.scoreDisplay}>{speedScore}分</Text>
            </View>
          </View>

          <View className={styles.overallScore}>
            <Text className={styles.overallScoreLabel}>综合评分</Text>
            <Text className={styles.overallScoreValue}>{overallScore}分</Text>
          </View>
        </View>

        <View className={styles.footer}>
          <Button className={styles.cancelBtn} onClick={onClose}>
            取消
          </Button>
          <Button className={styles.confirmBtn} onClick={handleSubmit}>
            保存
          </Button>
        </View>
      </View>
    </View>
  );
};

export default FeedbackModal;
