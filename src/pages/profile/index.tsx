import React, { useState } from 'react';
import { View, Text, ScrollView, Image, Input, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import type { UserContributionStats } from '../../types';

const DEFAULT_AVATAR_LIST = [
  '🐱',
  '🐶',
  '🦊',
  '🐼',
  '🦁',
  '🐯',
  '🐨',
  '🐸',
  '🐵',
  '🦄',
  '🐙',
  '🦋'
];

const ProfilePage: React.FC = () => {
  const {
    currentUser,
    setCurrentUserName,
    setCurrentUserAvatar,
    getUserContributionStats
  } = useData();

  const [, forceUpdate] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const stats: UserContributionStats = getUserContributionStats();

  useDidShow(() => {
    forceUpdate(prev => prev + 1);
  });

  const user = currentUser;

  const handleEditName = () => {
    if (!user) return;
    setTempName(user.name);
    setEditingName(true);
  };

  const handleSaveName = () => {
    const name = tempName.trim();
    if (!name) {
      Taro.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (name.length > 20) {
      Taro.showToast({ title: '昵称不能超过20个字符', icon: 'none' });
      return;
    }
    setCurrentUserName(name);
    setEditingName(false);
    Taro.showToast({ title: '修改成功', icon: 'success' });
  };

  const handleCancelEdit = () => {
    setEditingName(false);
    setTempName('');
  };

  const handleSelectAvatar = (avatar: string) => {
    setCurrentUserAvatar(avatar);
    setShowAvatarPicker(false);
    Taro.showToast({ title: '头像已更新', icon: 'success' });
  };

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <View className={styles.avatarSection} onClick={() => setShowAvatarPicker(true)}>
          <View className={styles.avatarWrapper}>
            {user?.avatar ? (
              <Text className={styles.avatarEmoji}>{user.avatar}</Text>
            ) : (
              <Text className={styles.avatarEmoji}>👤</Text>
            )}
          </View>
          <View className={styles.avatarEditHint}>
            <Text className={styles.editHintText}>点击更换头像</Text>
          </View>
        </View>

        <View className={styles.nameSection}>
          {editingName ? (
            <View className={styles.nameEditRow}>
              <Input
                className={styles.nameInput}
                value={tempName}
                placeholder="请输入昵称"
                maxlength={20}
                onInput={e => setTempName(e.detail.value)}
                focus
              />
              <View className={styles.nameActions}>
                <Button className={styles.nameBtn + ' ' + styles.cancelBtn} onClick={handleCancelEdit}>
                  取消
                </Button>
                <Button className={styles.nameBtn + ' ' + styles.saveBtn} onClick={handleSaveName}>
                  保存
                </Button>
              </View>
            </View>
          ) : (
            <View className={styles.nameDisplayRow} onClick={handleEditName}>
              <Text className={styles.userName}>{user?.name || '未设置昵称'}</Text>
              <Text className={styles.editIcon}>✏️</Text>
            </View>
          )}
          {user?.joinTime && (
            <Text className={styles.joinTime}>
              加入时间：{new Date(user.joinTime).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>

      <View className={styles.buildingSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>我的楼栋</Text>
          <Text className={styles.sectionSubtitle}>
            共 {stats.buildingsParticipated.length} 栋
          </Text>
        </View>

        {stats.buildingsParticipated.length > 0 ? (
          <View className={styles.buildingList}>
            {stats.buildingsParticipated.map(building => (
              <View key={building.buildingId} className={styles.buildingCard}>
                <View className={styles.buildingInfo}>
                  <Text className={styles.buildingName}>{building.buildingName}</Text>
                  <Text className={styles.buildingAddress}>{building.address}</Text>
                  <Text className={styles.buildingMeta}>
                    共 {building.totalFloors} 层
                  </Text>
                </View>
                <View className={styles.buildingStats}>
                  <Text className={styles.buildingTestCount}>{building.testCount}</Text>
                  <Text className={styles.buildingTestLabel}>次测试</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>🏢</Text>
            <Text className={styles.emptyText}>暂无绑定楼栋</Text>
            <Text className={styles.emptyHint}>快去首页添加楼栋并开始测试吧</Text>
          </View>
        )}
      </View>

      <View className={styles.statsSection}>
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>我的贡献</Text>
        </View>

        <View className={styles.statsGrid}>
          <View className={styles.statItem + ' ' + styles.statTests}>
            <View className={styles.statIcon}>📝</View>
            <Text className={styles.statValue}>{stats.totalTests}</Text>
            <Text className={styles.statLabel}>累计测试次数</Text>
          </View>

          <View className={styles.statItem + ' ' + styles.statFloors}>
            <View className={styles.statIcon}>🏠</View>
            <Text className={styles.statValue}>{stats.coveredFloors}</Text>
            <Text className={styles.statLabel}>覆盖楼层数</Text>
          </View>

          <View className={styles.statItem + ' ' + styles.statProblems}>
            <View className={styles.statIcon}>🔍</View>
            <Text className={styles.statValue}>{stats.problemFloors}</Text>
            <Text className={styles.statLabel}>发现问题楼层</Text>
          </View>
        </View>

        {stats.totalTests > 0 && (
          <View className={styles.statsSummary}>
            <View className={styles.summaryBar}>
              <View
                className={styles.summaryCovered}
                style={{
                  width: `${stats.coveredFloors > 0 ? Math.max(5, (stats.problemFloors / stats.coveredFloors) * 100) : 0}%`
                }}
              />
              <View
                className={styles.summaryProblem}
                style={{
                  width: `${stats.coveredFloors > 0 ? Math.max(5, ((stats.coveredFloors - stats.problemFloors) / stats.coveredFloors) * 100) : 0}%`
                }}
              />
            </View>
            <View className={styles.summaryLegend}>
              <View className={styles.legendItem}>
                <View className={styles.legendDot + ' ' + styles.legendCovered} />
                <Text className={styles.legendText}>正常楼层</Text>
              </View>
              <View className={styles.legendItem}>
                <View className={styles.legendDot + ' ' + styles.legendProblem} />
                <Text className={styles.legendText}>问题楼层</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {showAvatarPicker && (
        <View className={styles.modalOverlay} onClick={() => setShowAvatarPicker(false)}>
          <View className={styles.avatarPicker} onClick={e => e.stopPropagation()}>
            <View className={styles.pickerHeader}>
              <Text className={styles.pickerTitle}>选择头像</Text>
              <Text className={styles.pickerClose} onClick={() => setShowAvatarPicker(false)}>
                ×
              </Text>
            </View>
            <View className={styles.avatarGrid}>
              {DEFAULT_AVATAR_LIST.map((emoji, index) => (
                <View
                  key={index}
                  className={styles.avatarOption + (user?.avatar === emoji ? ' ' + styles.avatarActive : '')}
                  onClick={() => handleSelectAvatar(emoji)}
                >
                  <Text className={styles.avatarOptionEmoji}>{emoji}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default ProfilePage;
