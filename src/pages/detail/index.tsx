import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, ScrollView, Image } from '@tarojs/components';
import Taro, { useRouter, useDidShow } from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import ScoreBadge from '../../components/ScoreBadge';
import { SENSITIVITY_CONFIG, GRADE_CONFIG } from '../../types';
import { formatDate } from '../../utils/storage';

const DetailPage: React.FC = () => {
  const router = useRouter();
  const { getRecordsByBuilding, getRankList, getCurrentBuilding, addRecord, calculateRecordScore } = useData();

  const floor = parseInt(router.params.floor || '0', 10);
  const buildingId = router.params.buildingId || '';

  const [, forceUpdate] = useState(0);

  useDidShow(() => {
    console.log('[DetailPage] did show, floor:', floor, 'buildingId:', buildingId);
    forceUpdate(prev => prev + 1);
  });

  const allRecords = buildingId ? getRecordsByBuilding(buildingId) : [];
  const floorRecords = useMemo(() => {
    return allRecords
      .filter(r => r.floor === floor)
      .sort((a, b) => new Date(b.testTime).getTime() - new Date(a.testTime).getTime());
  }, [allRecords, floor]);

  const rankList = getRankList();
  const currentRank = rankList.find(r => r.floor === floor);
  const currentBuilding = getCurrentBuilding();

  const avgStats = useMemo(() => {
    if (floorRecords.length === 0) return null;

    const avgSensitivity = Math.round(
      floorRecords.reduce((sum, r) => sum + r.sensitivityScore, 0) / floorRecords.length
    );
    const avgDuration = Math.round(
      floorRecords.reduce((sum, r) => sum + r.duration, 0) / floorRecords.length
    );
    const hasBlindSpot = floorRecords.some(r => r.hasBlindSpot);
    const avgScore = Math.round(
      floorRecords.reduce((sum, r) => sum + calculateRecordScore(r).totalScore, 0) / floorRecords.length
    );

    let grade: 'excellent' | 'good' | 'poor' = 'poor';
    if (avgScore >= GRADE_CONFIG.excellent.minScore) grade = 'excellent';
    else if (avgScore >= GRADE_CONFIG.good.minScore) grade = 'good';

    return {
      avgSensitivity,
      avgDuration,
      hasBlindSpot,
      avgScore,
      grade,
      testCount: floorRecords.length
    };
  }, [floorRecords, calculateRecordScore]);

  const testerStats = useMemo(() => {
    const testerMap = new Map<string, {
      testerId: string;
      testerName: string;
      records: typeof floorRecords;
      avgScore: number;
      bestScore: number;
    }>();

    floorRecords.forEach(record => {
      const key = record.testerId || record.id;
      if (!testerMap.has(key)) {
        testerMap.set(key, {
          testerId: record.testerId || '',
          testerName: record.testerName || '匿名',
          records: [],
          avgScore: 0,
          bestScore: 0
        });
      }
      testerMap.get(key)!.records.push(record);
    });

    testerMap.forEach((stats) => {
      const scores = stats.records.map(r => calculateRecordScore(r).totalScore);
      stats.avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      stats.bestScore = Math.max(...scores);
    });

    return Array.from(testerMap.values()).sort((a, b) => b.avgScore - a.avgScore);
  }, [floorRecords, calculateRecordScore]);

  const getSensitivityLabel = (score: number): string => {
    if (score >= 85) return '轻声';
    if (score >= 60) return '正常';
    if (score >= 30) return '大声';
    return '喊叫';
  };

  const getDurationStatus = (duration: number): { label: string; status: 'excellent' | 'good' | 'poor' } => {
    if (duration >= 30 && duration <= 60) {
      return { label: '合理', status: 'excellent' };
    } else if (duration >= 15 && duration < 30) {
      return { label: '偏短', status: 'good' };
    } else if (duration > 60 && duration <= 120) {
      return { label: '偏长', status: 'good' };
    } else if (duration < 15) {
      return { label: '太短', status: 'poor' };
    } else {
      return { label: '太长', status: 'poor' };
    }
  };

  const handlePreviewImage = useCallback((photos: string[], index: number) => {
    Taro.previewImage({
      current: photos[index],
      urls: photos
    });
  }, []);

  const handleAddTest = () => {
    Taro.showModal({
      title: '新增测试',
      editable: true,
      placeholderText: '灵敏度：1-轻声 2-正常 3-大声 4-喊叫',
      success: (sensRes) => {
        if (sensRes.confirm && sensRes.content) {
          const sensLevel = parseInt(sensRes.content, 10);
          if (sensLevel >= 1 && sensLevel <= 4) {
            const levels: Array<'whisper' | 'normal' | 'loud' | 'shout'> = ['whisper', 'normal', 'loud', 'shout'];
            const level = levels[sensLevel - 1];
            const sensConfig = SENSITIVITY_CONFIG[level];

            Taro.showModal({
              title: '亮灯时长',
              editable: true,
              placeholderText: '请输入亮灯秒数',
              success: (durRes) => {
                if (durRes.confirm && durRes.content) {
                  const duration = parseInt(durRes.content, 10);
                  if (duration > 0 && duration <= 300) {
                    Taro.showModal({
                      title: '是否有盲区？',
                      editable: true,
                      placeholderText: '有盲区请输入位置，没有请直接确定',
                      success: (blindRes) => {
                        const hasBlindSpot = !!(blindRes.confirm && blindRes.content);
                        const blindSpotDescription = hasBlindSpot ? blindRes.content!.trim() : undefined;

                        if (hasBlindSpot && !blindSpotDescription) {
                          Taro.showToast({ title: '请输入盲区位置', icon: 'none' });
                          return;
                        }

                        if (currentBuilding && buildingId) {
                          addRecord({
                            buildingId,
                            buildingName: currentBuilding.name,
                            floor,
                            sensitivityLevel: level,
                            sensitivityScore: sensConfig.score,
                            duration,
                            hasBlindSpot,
                            blindSpotDescription
                          });
                          Taro.showToast({ title: '添加成功', icon: 'success' });
                          forceUpdate(prev => prev + 1);
                        }
                      }
                    });
                  } else {
                    Taro.showToast({ title: '请输入有效的时长', icon: 'none' });
                  }
                }
              }
            });
          } else {
            Taro.showToast({ title: '请输入1-4', icon: 'none' });
          }
        }
      }
    });
  };

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <View className={styles.floorInfo}>
          <View className={styles.floorTitle}>
            <Text className={styles.floorNumber}>{floor}楼</Text>
            <Text className={styles.buildingName}>
              {currentBuilding ? `${currentBuilding.name} · ${currentBuilding.address}` : '请选择楼栋'}
            </Text>
          </View>
          {currentRank && (
            <ScoreBadge score={currentRank.averageScore} grade={currentRank.grade} size="large" />
          )}
        </View>

        {avgStats ? (
          <>
            <View className={styles.statsRow}>
              <View className={styles.statItem}>
                <Text className={styles.statValue}>{avgStats.testCount}</Text>
                <Text className={styles.statLabel}>测试次数</Text>
              </View>
              <View className={styles.statItem}>
                <Text className={styles.statValue}>{currentRank?.rank || '-'}</Text>
                <Text className={styles.statLabel}>当前排名</Text>
              </View>
              <View className={styles.statItem}>
                <Text className={styles.statValue}>{testerStats.length}</Text>
                <Text className={styles.statLabel}>测试人数</Text>
              </View>
            </View>

            <View className={styles.avgScoreSection}>
              <Text className={styles.avgScoreLabel}>综合评分</Text>
              <Text className={styles.avgScoreValue}>{avgStats.avgScore}</Text>
              <Text className={styles.avgGrade}>{GRADE_CONFIG[avgStats.grade].label}</Text>
              {testerStats.length > 1 && (
                <Text className={styles.avgHint}>（{testerStats.length}人平均值）</Text>
              )}
            </View>
          </>
        ) : null}
      </View>

      {avgStats ? (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>📊 综合统计</Text>
          <View className={styles.summaryCard}>
            <View className={styles.summaryRow}>
              <Text className={styles.summaryLabel}>平均灵敏度</Text>
              <Text className={classNames(styles.summaryValue, styles[avgStats.grade])}>
                {getSensitivityLabel(avgStats.avgSensitivity)}（{avgStats.avgSensitivity}分）
              </Text>
            </View>
            <View className={styles.summaryRow}>
              <Text className={styles.summaryLabel}>平均亮灯时长</Text>
              <Text className={classNames(styles.summaryValue, styles[getDurationStatus(avgStats.avgDuration).status])}>
                {avgStats.avgDuration}秒
              </Text>
            </View>
            <View className={styles.summaryRow}>
              <Text className={styles.summaryLabel}>感应盲区</Text>
              <Text className={classNames(styles.summaryValue, {
                [styles.poor]: avgStats.hasBlindSpot,
                [styles.excellent]: !avgStats.hasBlindSpot
              })}>
                {avgStats.hasBlindSpot ? '存在' : '无'}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {testerStats.length > 1 && (
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>👥 各邻居贡献</Text>
          <View className={styles.contributionList}>
            {testerStats.map((tester, index) => {
              const testerGrade: 'excellent' | 'good' | 'poor' = tester.avgScore >= 80 ? 'excellent' : tester.avgScore >= 50 ? 'good' : 'poor';

              return (
                <View key={tester.testerId || index} className={styles.contributionCard}>
                  <View className={styles.contributionHeader}>
                    <View className={styles.testerInfo}>
                      <View className={styles.testerAvatar}>
                        <Text className={styles.testerAvatarText}>{tester.testerName.charAt(0)}</Text>
                      </View>
                      <View className={styles.testerDetail}>
                        <Text className={styles.testerName}>{tester.testerName}</Text>
                        <Text className={styles.testerRecordCount}>{tester.records.length}次测试</Text>
                      </View>
                    </View>
                    <View className={styles.testerScoreArea}>
                      <Text className={classNames(styles.testerAvgScore, styles[testerGrade])}>
                        均分{tester.avgScore}
                      </Text>
                      <Text className={styles.testerBestScore}>
                        最高{tester.bestScore}
                      </Text>
                    </View>
                  </View>

                  <View className={styles.testerRecords}>
                    {tester.records.map(record => {
                      const sensitivityInfo = SENSITIVITY_CONFIG[record.sensitivityLevel];
                      const durationStatus = getDurationStatus(record.duration);
                      const recScore = calculateRecordScore(record);

                      return (
                        <View key={record.id} className={styles.testerRecordItem}>
                          <View className={styles.testerRecordHeader}>
                            <Text className={styles.testerRecordTime}>{formatDate(record.testTime)}</Text>
                            <ScoreBadge score={recScore.totalScore} grade={recScore.grade} size="small" />
                          </View>
                          <View className={styles.testerRecordDetails}>
                            <Text className={styles.testerRecordDetail}>
                              灵敏度：{sensitivityInfo.label}
                            </Text>
                            <Text className={styles.testerRecordDetail}>
                              时长：{record.duration}秒（{durationStatus.label}）
                            </Text>
                            {record.hasBlindSpot && record.blindSpotDescription && (
                              <Text className={styles.testerRecordBlind}>
                                盲区：{record.blindSpotDescription}
                              </Text>
                            )}
                            {record.photos && record.photos.length > 0 && (
                              <View className={styles.testerRecordPhotos}>
                                {record.photos.slice(0, 3).map((photo, idx) => (
                                  <Image
                                    key={idx}
                                    className={styles.testerRecordPhoto}
                                    src={photo}
                                    mode="aspectFill"
                                    onClick={() => handlePreviewImage(record.photos!, idx)}
                                  />
                                ))}
                                {record.photos.length > 3 && (
                                  <View className={styles.testerRecordMore}>
                                    <Text className={styles.testerRecordMoreText}>+{record.photos.length - 3}</Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View className={styles.section}>
        <Text className={styles.sectionTitle}>
          {testerStats.length > 1 ? '📝 全部测试记录' : '📝 历史测试记录'}
        </Text>
        {floorRecords.length > 0 ? (
          <View className={styles.recordsList}>
            {floorRecords.map(record => {
              const sensitivityInfo = SENSITIVITY_CONFIG[record.sensitivityLevel];
              const durationStatus = getDurationStatus(record.duration);
              const recScore = calculateRecordScore(record);

              return (
                <View key={record.id} className={styles.recordCard}>
                  <View className={styles.recordHeader}>
                    <View className={styles.recordHeaderLeft}>
                      <Text className={styles.recordTime}>{formatDate(record.testTime)}</Text>
                      {record.testerName && testerStats.length > 1 && (
                        <View className={styles.testerTag}>
                          <Text className={styles.testerTagText}>{record.testerName}</Text>
                        </View>
                      )}
                    </View>
                    <ScoreBadge score={recScore.totalScore} grade={recScore.grade} size="small" />
                  </View>

                  <View className={styles.recordContent}>
                    <View className={styles.recordItem}>
                      <Text className={styles.recordItemLabel}>灵敏度</Text>
                      <Text className={styles.recordItemValue}>
                        {sensitivityInfo.label}（{sensitivityInfo.description}）
                      </Text>
                    </View>
                    <View className={styles.recordItem}>
                      <Text className={styles.recordItemLabel}>亮灯时长</Text>
                      <Text className={classNames(styles.recordItemValue, styles[durationStatus.status])}>
                        {record.duration}秒（{durationStatus.label}）
                      </Text>
                    </View>
                    <View className={styles.recordItem}>
                      <Text className={styles.recordItemLabel}>感应盲区</Text>
                      <Text className={classNames(styles.recordItemValue, {
                        [styles.hasBlind]: record.hasBlindSpot,
                        [styles.noBlind]: !record.hasBlindSpot
                      })}>
                        {record.hasBlindSpot ? '有' : '无'}
                      </Text>
                    </View>
                    {record.hasBlindSpot && record.blindSpotDescription && (
                      <View className={styles.blindSpotDesc}>
                        <Text className={styles.blindSpotText}>
                          盲区位置：{record.blindSpotDescription}
                        </Text>
                      </View>
                    )}
                    {record.photos && record.photos.length > 0 && (
                      <View className={styles.recordPhotos}>
                        <Text className={styles.recordPhotosLabel}>现场照片</Text>
                        <View className={styles.recordPhotoGrid}>
                          {record.photos.map((photo, idx) => (
                            <Image
                              key={idx}
                              className={styles.recordPhotoItem}
                              src={photo}
                              mode="aspectFill"
                              onClick={() => handlePreviewImage(record.photos!, idx)}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className={styles.emptyState}>
            <Text className={styles.emptyIcon}>📋</Text>
            <Text className={styles.emptyText}>暂无测试记录</Text>
            <Text className={styles.emptyHint}>点击下方按钮添加测试记录</Text>
          </View>
        )}
      </View>

      <Button className={styles.actionBtn} onClick={handleAddTest}>
        新增测试记录
      </Button>
    </ScrollView>
  );
};

export default DetailPage;
