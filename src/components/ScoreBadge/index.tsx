import React from 'react';
import { View, Text } from '@tarojs/components';
import classNames from 'classnames';
import styles from './index.module.scss';
import { GRADE_CONFIG } from '../../types';

interface ScoreBadgeProps {
  score: number;
  grade: 'excellent' | 'good' | 'poor';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  grade,
  size = 'medium',
  showLabel = true
}) => {
  const gradeInfo = GRADE_CONFIG[grade];

  return (
    <View
      className={classNames(styles.badge, styles[size], {
        [styles.excellent]: grade === 'excellent',
        [styles.good]: grade === 'good',
        [styles.poor]: grade === 'poor'
      })}
    >
      <Text className={styles.score}>{score}</Text>
      {showLabel && <Text className={styles.label}>{gradeInfo.label}</Text>}
    </View>
  );
};

export default ScoreBadge;
