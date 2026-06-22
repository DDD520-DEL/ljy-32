import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import classNames from 'classnames';
import styles from './index.module.scss';
import { ComplaintRecord, COMPLAINT_STATUS_CONFIG } from '../../types';
import { formatDate } from '../../utils/storage';

interface ComplaintTimelineProps {
  records: ComplaintRecord[];
  onAddFeedback?: (record: ComplaintRecord) => void;
  onViewDetail?: (record: ComplaintRecord) => void;
}

const ComplaintTimeline: React.FC<ComplaintTimelineProps> = ({
  records,
  onAddFeedback,
  onViewDetail
}) => {
  if (records.length === 0) {
    return (
      <View className={styles.container}>
        <View className={styles.header}>
          <Text className={styles.title}>📋 投诉历史</Text>
          <Text className={styles.count}>共 0 条</Text>
        </View>
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>📭</Text>
          <Text className={styles.emptyText}>暂无投诉记录</Text>
        </View>
      </View>
    );
  }

  const getStatusStyle = (status: string) => {
    const config = COMPLAINT_STATUS_CONFIG[status as keyof typeof COMPLAINT_STATUS_CONFIG];
    return {
      background: config?.bgColor || 'rgba(0,0,0,0.1)',
      color: config?.color || '#999'
    };
  };

  const getDotColor = (status: string) => {
    const config = COMPLAINT_STATUS_CONFIG[status as keyof typeof COMPLAINT_STATUS_CONFIG];
    return {
      background: config?.color || '#FF6B35'
    };
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.title}>📋 投诉历史</Text>
        <Text className={styles.count}>共 {records.length} 条</Text>
      </View>

      <View className={styles.timeline}>
        {records.map((record) => {
          const statusConfig = COMPLAINT_STATUS_CONFIG[record.status];
          return (
            <View key={record.id} className={styles.timelineItem}>
              <View
                className={styles.timelineDot}
                style={getDotColor(record.status)}
              />
              <View className={styles.timelineContent}>
                <View className={styles.itemHeader}>
                  <View className={styles.floorInfo}>
                    <Text className={styles.floorNumbers}>
                      {record.poorFloors.join('、')}楼
                    </Text>
                    <Text className={styles.complaintTime}>
                      {formatDate(record.complaintTime)}
                    </Text>
                  </View>
                  <View
                    className={classNames(styles.statusBadge)}
                    style={getStatusStyle(record.status)}
                  >
                    <Text>{statusConfig?.icon} {statusConfig?.label}</Text>
                  </View>
                </View>

                <View className={styles.itemBody}>
                  <Text className={styles.complaintText}>{record.complaintText}</Text>
                </View>

                <View className={styles.itemMeta}>
                  <View className={styles.metaItem}>
                    <Text>📸 {record.photoCount}张照片</Text>
                  </View>
                  <View className={styles.metaItem}>
                    <Text>🏢 {record.buildingName}</Text>
                  </View>
                </View>

                {record.feedback && (
                  <View className={styles.feedbackSection}>
                    <View className={styles.feedbackHeader}>
                      <Text className={styles.feedbackLabel}>📨 物业回复</Text>
                      <Text className={styles.feedbackTime}>
                        {formatDate(record.feedback.replyTime)}
                      </Text>
                    </View>
                    <Text className={styles.feedbackContent}>
                      {record.feedback.replyContent}
                    </Text>
                    <View className={styles.scoreRow}>
                      <View className={styles.scoreItem}>
                        <Text>态度：</Text>
                        <Text className={styles.scoreValue}>
                          {record.feedback.attitudeScore}分
                        </Text>
                      </View>
                      <View className={styles.scoreItem}>
                        <Text>速度：</Text>
                        <Text className={styles.scoreValue}>
                          {record.feedback.speedScore}分
                        </Text>
                      </View>
                      <View className={styles.scoreItem}>
                        <Text>综合：</Text>
                        <Text className={styles.scoreValue}>
                          {record.feedback.overallScore}分
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <View className={styles.itemActions}>
                  {!record.feedback && onAddFeedback && (
                    <Button
                      className={classNames(styles.actionBtn, styles.primary)}
                      onClick={() => onAddFeedback(record)}
                    >
                      补充反馈
                    </Button>
                  )}
                  {onViewDetail && (
                    <Button
                      className={classNames(styles.actionBtn, styles.secondary)}
                      onClick={() => onViewDetail(record)}
                    >
                      查看详情
                    </Button>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default ComplaintTimeline;
