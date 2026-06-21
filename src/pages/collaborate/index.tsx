import React, { useState, useCallback } from 'react';
import { View, Text, Button, ScrollView, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import type { InvitationCode } from '../../types';
import { formatDate } from '../../utils/storage';

const CollaboratePage: React.FC = () => {
  const {
    currentBuildingId,
    getCurrentBuilding,
    currentUser,
    collaborations,
    generateInvitation,
    joinByCode,
    setCurrentUserName,
    setCurrentBuildingId,
    getParticipants
  } = useData();

  const currentBuilding = getCurrentBuilding();
  const [, forceUpdate] = useState(0);
  const [inputCode, setInputCode] = useState('');
  const [invitationResult, setInvitationResult] = useState<InvitationCode | null>(null);
  const [editNameMode, setEditNameMode] = useState(false);
  const [nameInput, setNameInput] = useState('');

  useDidShow(() => {
    forceUpdate(prev => prev + 1);
  });

  const participants = currentBuildingId ? getParticipants(currentBuildingId) : [];

  const handleGenerateCode = useCallback(() => {
    if (!currentBuildingId) {
      Taro.showToast({ title: '请先选择楼栋', icon: 'none' });
      return;
    }

    const result = generateInvitation();
    if (result) {
      setInvitationResult(result);
      Taro.showToast({ title: '口令生成成功', icon: 'success' });
    }
  }, [currentBuildingId, generateInvitation]);

  const handleCopyCodeOnly = useCallback(async () => {
    if (!invitationResult) return;
    try {
      await Taro.setClipboardData({ data: invitationResult.code });
      Taro.showToast({ title: '口令已复制', icon: 'success' });
    } catch {
      Taro.showToast({ title: '复制失败', icon: 'none' });
    }
  }, [invitationResult]);

  const handleCopyCode = useCallback(async () => {
    if (!invitationResult || !currentBuilding) return;

    const text = `【楼道声控灯测试邀请】\n` +
      `${currentBuilding.name}的邻居你好！我正在测试${currentBuilding.address}的楼道声控灯质量。\n` +
      `邀请你一起参与测试，数据更有说服力！\n\n` +
      `邀请口令：\n${invitationResult.code}\n\n` +
      `楼栋：${currentBuilding.name}\n` +
      `地址：${currentBuilding.address}\n` +
      `共${currentBuilding.totalFloors}层\n\n` +
      `打开"楼道声控灯评测"小程序，在"邻里协作"页面粘贴口令即可加入。`;

    try {
      await Taro.setClipboardData({ data: text });
      Taro.showToast({ title: '已复制邀请文案', icon: 'success' });
    } catch {
      Taro.showToast({ title: '复制失败', icon: 'none' });
    }
  }, [invitationResult, currentBuilding]);

  const handleJoinByCode = useCallback(() => {
    if (!inputCode.trim()) {
      Taro.showToast({ title: '请输入口令', icon: 'none' });
      return;
    }

    const result = joinByCode(inputCode.trim());
    if (result.success) {
      Taro.showToast({ title: '加入成功！', icon: 'success' });
      setInputCode('');
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/record/index' });
      }, 1500);
    } else {
      Taro.showToast({ title: result.reason || '加入失败', icon: 'none' });
    }
  }, [inputCode, joinByCode]);

  const handleEditName = useCallback(() => {
    if (!nameInput.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    setCurrentUserName(nameInput.trim());
    setEditNameMode(false);
    Taro.showToast({ title: '昵称已更新', icon: 'success' });
    forceUpdate(prev => prev + 1);
  }, [nameInput, setCurrentUserName]);

  const handleStartEditName = useCallback(() => {
    setNameInput(currentUser?.name || '');
    setEditNameMode(true);
  }, [currentUser]);

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <Text className={styles.title}>邻里协作</Text>
        <Text className={styles.subtitle}>邀请邻居一起测试，数据更有说服力</Text>
      </View>

      <View className={styles.userCard}>
        <View className={styles.userHeader}>
          <View className={styles.avatar}>
            <Text className={styles.avatarText}>
              {(currentUser?.name || '邻').charAt(0)}
            </Text>
          </View>
          <View className={styles.userInfo}>
            {editNameMode ? (
              <View className={styles.nameEditRow}>
                <Input
                  className={styles.nameInput}
                  value={nameInput}
                  onInput={e => setNameInput(e.detail.value)}
                  placeholder="输入你的昵称"
                  maxLength={10}
                />
                <Button className={styles.nameSaveBtn} onClick={handleEditName}>保存</Button>
              </View>
            ) : (
              <View className={styles.nameRow}>
                <Text className={styles.userName}>{currentUser?.name || '未设置昵称'}</Text>
                <Text className={styles.editBtn} onClick={handleStartEditName}>修改</Text>
              </View>
            )}
            <Text className={styles.userHint}>测试记录将以此昵称展示给邻居</Text>
          </View>
        </View>
      </View>

      {currentBuilding && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>🏠 当前楼栋</Text>
          <View className={styles.buildingCard}>
            <Text className={styles.buildingName}>{currentBuilding.name}</Text>
            <Text className={styles.buildingAddress}>{currentBuilding.address}</Text>
            <Text className={styles.buildingFloors}>共{currentBuilding.totalFloors}层</Text>
          </View>
        </View>
      )}

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>📢 生成邀请口令</Text>
        <View className={styles.inviteCard}>
          <Text className={styles.inviteDesc}>
            生成邀请口令分享给邻居，邻居粘贴口令后可加入同一楼栋的测试。口令包含楼栋信息，无需对方已有该楼栋。
          </Text>

          {invitationResult ? (
            <View className={styles.codeResult}>
              <View className={styles.codeDisplay}>
                <Text className={styles.codeText}>{invitationResult.code}</Text>
              </View>
              <View className={styles.codeMeta}>
                <Text className={styles.codeMetaText}>
                  楼栋：{invitationResult.buildingName} | {invitationResult.totalFloors}层 | 有效期7天
                </Text>
                <Text className={styles.codeMetaText}>
                  生成时间：{formatDate(invitationResult.createTime)}
                </Text>
              </View>
              <View className={styles.codeActions}>
                <Button className={styles.copyBtn} onClick={handleCopyCodeOnly}>
                  复制口令
                </Button>
                <Button className={styles.regenerateBtn} onClick={handleCopyCode}>
                  复制口令和邀请文案
                </Button>
                <Button className={styles.regenerateBtn} onClick={handleGenerateCode}>
                  重新生成
                </Button>
              </View>
            </View>
          ) : (
            <Button
              className={styles.generateBtn}
              onClick={handleGenerateCode}
              disabled={!currentBuildingId}
            >
              {currentBuildingId ? '生成邀请口令' : '请先选择楼栋'}
            </Button>
          )}
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>🔗 输入口令加入</Text>
        <View className={styles.joinCard}>
          <Text className={styles.joinDesc}>
            收到邻居的邀请口令？粘贴后即可加入该楼栋，即使你还没有该楼栋也能自动创建。加入后大家测试同一楼层的记录会合并计算平均分。
          </Text>
          <View className={styles.inputRow}>
            <Input
              className={styles.codeInput}
              value={inputCode}
              onInput={e => setInputCode(e.detail.value)}
              placeholder="粘贴邀请口令"
            />
            <Button className={styles.joinBtn} onClick={handleJoinByCode}>
              加入
            </Button>
          </View>
        </View>
      </View>

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>
          👥 协作成员（{participants.length}人）
        </Text>
        {participants.length > 0 ? (
          <View className={styles.participantsList}>
            {participants.map((p, index) => (
              <View key={p.id} className={styles.participantItem}>
                <View className={styles.participantAvatar}>
                  <Text className={styles.participantAvatarText}>{p.name.charAt(0)}</Text>
                </View>
                <View className={styles.participantInfo}>
                  <Text className={styles.participantName}>{p.name}</Text>
                  <Text className={styles.participantJoinTime}>
                    加入时间：{formatDate(p.joinTime)}
                  </Text>
                </View>
                {index === 0 && (
                  <View className={styles.organizerBadge}>
                    <Text className={styles.organizerText}>发起人</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View className={styles.emptyParticipants}>
            <Text className={styles.emptyText}>暂无协作成员</Text>
            <Text className={styles.emptyHint}>生成邀请口令邀请邻居加入吧</Text>
          </View>
        )}
      </View>

      {collaborations.length > 0 && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>📋 参与的楼栋</Text>
          <View className={styles.collabList}>
            {collaborations.map(session => (
              <View
                key={session.buildingId}
                className={styles.collabItem}
                onClick={() => {
                  setCurrentBuildingId(session.buildingId);
                  Taro.switchTab({ url: '/pages/home/index' });
                }}
              >
                <View className={styles.collabInfo}>
                  <Text className={styles.collabName}>{session.buildingName}</Text>
                  <Text className={styles.collabCount}>
                    {session.participants.length}人参与
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className={styles.tips}>
        <Text className={styles.tipsTitle}>💡 使用说明</Text>
        <Text className={styles.tipsText}>
          1. 生成邀请口令后，复制分享给邻居{'\n'}
          2. 邻居粘贴口令即可加入同一楼栋{'\n'}
          3. 口令自带楼栋信息，邻居无需先有该楼栋{'\n'}
          4. 两人以上测试同一楼层后，排行榜取平均值{'\n'}
          5. 详情页可查看每位邻居的测试记录和贡献{'\n'}
          6. 口令有效期7天，过期可重新生成
        </Text>
      </View>
    </ScrollView>
  );
};

export default CollaboratePage;
