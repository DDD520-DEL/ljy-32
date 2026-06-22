import React, { useState, useMemo } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import { COMPARE_METRICS, SENSITIVITY_CONFIG } from '../../types';
import type { BuildingStats, CompareMetricConfig } from '../../types';

const BUILDING_COLORS = [
  { primary: '#FF6B35', light: 'rgba(255, 107, 53, 0.15)', bar: 'linear-gradient(180deg, #FF8C5A 0%, #FF6B35 100%)' },
  { primary: '#0EA5E9', light: 'rgba(14, 165, 233, 0.15)', bar: 'linear-gradient(180deg, #38BDF8 0%, #0EA5E9 100%)' },
  { primary: '#8B5CF6', light: 'rgba(139, 92, 246, 0.15)', bar: 'linear-gradient(180deg, #A78BFA 0%, #8B5CF6 100%)' },
  { primary: '#10B981', light: 'rgba(16, 185, 129, 0.15)', bar: 'linear-gradient(180deg, #34D399 0%, #10B981 100%)' },
  { primary: '#F59E0B', light: 'rgba(245, 158, 11, 0.15)', bar: 'linear-gradient(180deg, #FBBF24 0%, #F59E0B 100%)' },
  { primary: '#EF4444', light: 'rgba(239, 68, 68, 0.15)', bar: 'linear-gradient(180deg, #F87171 0%, #EF4444 100%)' }
];

const SENSITIVITY_COLORS: Record<string, { bg: string; bar: string }> = {
  whisper: { bg: '#10B981', bar: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)' },
  normal:  { bg: '#0EA5E9', bar: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)' },
  loud:    { bg: '#F59E0B', bar: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)' },
  shout:   { bg: '#EF4444', bar: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)' }
};

const CompareResultPage: React.FC = () => {
  const router = useRouter();
  const { getMultiBuildingStats } = useData();

  const [viewMode, setViewMode] = useState<'bar' | 'progress'>('bar');
  const [, forceUpdate] = useState(0);

  useDidShow(() => {
    console.log('[CompareResultPage] did show');
    forceUpdate(prev => prev + 1);
  });

  const buildingIds = useMemo(() => {
    const idsParam = router.params.ids || '';
    return idsParam.split(',').filter(Boolean);
  }, [router.params.ids]);

  const statsList = useMemo(() => {
    return getMultiBuildingStats(buildingIds);
  }, [buildingIds, getMultiBuildingStats]);

  const maxValues = useMemo(() => {
    const max: Record<string, number> = {};
    COMPARE_METRICS.forEach(metric => {
      const values = statsList.map(s => s[metric.key] as number);
      max[metric.key] = Math.max(...values, 1);
    });
    return max;
  }, [statsList]);

  const rankings = useMemo(() => {
    const result: Record<string, Array<{ buildingId: string; rank: number }>> = {};
    COMPARE_METRICS.forEach(metric => {
      const sorted = [...statsList]
        .map(s => ({ buildingId: s.buildingId, value: s[metric.key] as number }))
        .sort((a, b) => metric.higherIsBetter ? b.value - a.value : a.value - b.value);
      result[metric.key] = sorted.map((item, idx) => ({
        buildingId: item.buildingId,
        rank: idx + 1
      }));
    });
    return result;
  }, [statsList]);

  const getBuildingColor = (index: number) => {
    return BUILDING_COLORS[index % BUILDING_COLORS.length];
  };

  const getRankForMetric = (metricKey: string, buildingId: string) => {
    return rankings[metricKey]?.find(r => r.buildingId === buildingId)?.rank || 0;
  };

  const formatMetricValue = (value: number, metric: CompareMetricConfig) => {
    if (metric.isPercentage) {
      return `${value}${metric.unit}`;
    }
    return `${value}${metric.unit}`;
  };

  const getAdviceText = () => {
    if (statsList.length < 2) return '';
    
    const worstBuilding = [...statsList].sort(
      (a, b) => a.avgTotalScore - b.avgTotalScore
    )[0];
    const bestBuilding = [...statsList].sort(
      (a, b) => b.avgTotalScore - a.avgTotalScore
    )[0];
    
    const scoreGap = bestBuilding.avgTotalScore - worstBuilding.avgTotalScore;
    const replaceGap = worstBuilding.needReplaceRatio - bestBuilding.needReplaceRatio;
    
    const advices: string[] = [];
    
    if (scoreGap >= 20) {
      advices.push(`${worstBuilding.buildingName}综合评分比${bestBuilding.buildingName}低${scoreGap}分，建议优先改造。`);
    }
    
    if (replaceGap >= 20) {
      advices.push(`${worstBuilding.buildingName}待更换比例高出${replaceGap}%，存在较多需要更换的声控灯。`);
    }
    
    if (worstBuilding.testedFloorsRatio < 50) {
      advices.push(`${worstBuilding.buildingName}测试覆盖率仅${worstBuilding.testedFloorsRatio}%，建议组织邻居补充测试。`);
    }
    
    return advices.join(' ');
  };

  const handleReSelect = () => {
    Taro.navigateBack();
  };

  const handleBackToHome = () => {
    Taro.switchTab({ url: '/pages/home/index' });
  };

  if (statsList.length === 0) {
    return (
      <ScrollView className={styles.container} scrollY>
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>📊</Text>
          <Text className={styles.emptyText}>暂无对比数据</Text>
          <Button className={styles.backBtn} onClick={handleReSelect}>
            返回重新选择
          </Button>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <View className={styles.headerRow}>
          <View className={styles.headerText}>
            <Text className={styles.title}>楼栋对比结果</Text>
            <Text className={styles.subtitle}>共 {statsList.length} 栋楼参与对比</Text>
          </View>
        </View>
      </View>

      <View className={styles.viewToggle}>
        <Button
          className={classNames(styles.toggleBtn, { [styles.active]: viewMode === 'bar' })}
          onClick={() => setViewMode('bar')}
        >
          📊 柱状图
        </Button>
        <Button
          className={classNames(styles.toggleBtn, { [styles.active]: viewMode === 'progress' })}
          onClick={() => setViewMode('progress')}
        >
          📈 进度条
        </Button>
      </View>

      <View className={styles.buildingLegend}>
        {statsList.map((stats, index) => {
          const color = getBuildingColor(index);
          return (
            <View key={stats.buildingId} className={styles.legendItem}>
              <View className={styles.legendColor} style={{ backgroundColor: color.primary }} />
              <View className={styles.legendText}>
                <Text className={styles.legendName}>{stats.buildingName}</Text>
                <Text className={styles.legendSub}>{stats.address}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {COMPARE_METRICS.map(metric => (
        <View key={metric.key} className={styles.metricSection}>
          <View className={styles.metricHeader}>
            <View className={styles.metricTitleRow}>
              <Text className={styles.metricIcon}>
                {metric.higherIsBetter ? '📈' : '⚠️'}
              </Text>
              <Text className={styles.metricTitle}>{metric.label}</Text>
              <Text className={styles.metricTip}>
                ({metric.higherIsBetter ? '越高越好' : '越低越好'})
              </Text>
            </View>
          </View>

          {viewMode === 'bar' ? (
            <View className={styles.barChart}>
              <View className={styles.barContainer}>
                {statsList.map((stats, index) => {
                  const color = getBuildingColor(index);
                  const value = stats[metric.key] as number;
                  const maxVal = maxValues[metric.key];
                  const heightPercent = (value / maxVal) * 100;
                  const rank = getRankForMetric(metric.key, stats.buildingId);
                  
                  return (
                    <View key={stats.buildingId} className={styles.barColumn}>
                      <View className={styles.barValueWrapper}>
                        <Text className={styles.barValue} style={{ color: color.primary }}>
                          {formatMetricValue(value, metric)}
                        </Text>
                        {rank === 1 && (
                          <View className={styles.rankBadge}>
                            <Text className={styles.rankBadgeText}>🥇</Text>
                          </View>
                        )}
                      </View>
                      <View className={styles.barTrack}>
                        <View
                          className={styles.barFill}
                          style={{
                            height: `${Math.max(heightPercent, 4)}%`,
                            background: color.bar
                          }}
                        />
                      </View>
                      <View className={styles.barLabel}>
                        <Text className={styles.barLabelText}>{stats.buildingName}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <View className={styles.yAxisLabels}>
                <Text className={styles.yAxisLabel}>
                  {formatMetricValue(Math.round(maxValues[metric.key]), metric)}
                </Text>
                <Text className={styles.yAxisLabel}>0</Text>
              </View>
            </View>
          ) : (
            <View className={styles.progressList}>
              {statsList.map((stats, index) => {
                const color = getBuildingColor(index);
                const value = stats[metric.key] as number;
                const maxVal = maxValues[metric.key];
                const widthPercent = metric.isPercentage
                  ? value
                  : Math.round((value / maxVal) * 100);
                const rank = getRankForMetric(metric.key, stats.buildingId);
                
                return (
                  <View key={stats.buildingId} className={styles.progressItem}>
                    <View className={styles.progressHeader}>
                      <View className={styles.progressBuilding}>
                        <View
                          className={styles.progressDot}
                          style={{ backgroundColor: color.primary }}
                        />
                        <Text className={styles.progressBuildingName}>{stats.buildingName}</Text>
                      </View>
                      <View className={styles.progressValueRow}>
                        <Text
                          className={styles.progressValue}
                          style={{ color: color.primary }}
                        >
                          {formatMetricValue(value, metric)}
                        </Text>
                        {rank === 1 && (
                          <Text className={styles.rankEmoji}>🥇</Text>
                        )}
                      </View>
                    </View>
                    <View className={styles.progressTrack}>
                      <View
                        className={styles.progressFill}
                        style={{
                          width: `${Math.max(widthPercent, 2)}%`,
                          background: `linear-gradient(90deg, ${color.primary}88 0%, ${color.primary} 100%)`
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ))}

      <View className={styles.detailSection}>
        <Text className={styles.sectionTitle}>📋 详细数据对比</Text>
        <ScrollView className={styles.tableWrapper} scrollX>
          <View className={styles.dataTable}>
            <View className={styles.tableHeader}>
              <View className={styles.tableCell + ' ' + styles.tableHeaderCell + ' ' + styles.firstCell}>
                <Text>指标</Text>
              </View>
              {statsList.map((stats, index) => {
                const color = getBuildingColor(index);
                return (
                  <View
                    key={stats.buildingId}
                    className={styles.tableCell + ' ' + styles.tableHeaderCell}
                    style={{ borderColor: color.primary }}
                  >
                    <Text style={{ color: color.primary }}>{stats.buildingName}</Text>
                  </View>
                );
              })}
            </View>
            {[
              { label: '综合平均分', key: 'avgTotalScore', unit: '分' },
              { label: '平均灵敏度', key: 'avgSensitivityScore', unit: '分' },
              { label: '测试总次数', key: 'totalTests', unit: '次' },
              { label: '已测楼层数', key: 'testedFloors', unit: '层' },
              { label: '已测覆盖率', key: 'testedFloorsRatio', unit: '%', isPercent: true },
              { label: '优秀次数', key: 'excellentCount', unit: '次' },
              { label: '优秀率', key: 'excellentRatio', unit: '%', isPercent: true },
              { label: '良好次数', key: 'goodCount', unit: '次' },
              { label: '较差次数', key: 'poorCount', unit: '次' },
              { label: '较差率', key: 'poorRatio', unit: '%', isPercent: true },
              { label: '待更换次数', key: 'needReplaceCount', unit: '次' },
              { label: '待更换比例', key: 'needReplaceRatio', unit: '%', isPercent: true },
              { label: '盲区次数', key: 'blindSpotCount', unit: '次' }
            ].map((row, rowIdx) => (
              <View key={row.key} className={classNames(styles.tableRow, { [styles.altRow]: rowIdx % 2 === 1 })}>
                <View className={styles.tableCell + ' ' + styles.firstCell + ' ' + styles.labelCell}>
                  <Text>{row.label}</Text>
                </View>
                {statsList.map((stats, index) => {
                  const color = getBuildingColor(index);
                  const val = stats[row.key as keyof BuildingStats] as number;
                  return (
                    <View key={stats.buildingId} className={styles.tableCell}>
                      <Text style={{ color: color.primary, fontWeight: 600 }}>
                        {val}{row.unit}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View className={styles.detailSection}>
        <Text className={styles.sectionTitle}>🎚️ 灵敏度分布对比</Text>
        {statsList.map((stats, index) => {
          const color = getBuildingColor(index);
          const total = stats.totalTests || 1;
          const whisperPct = Math.round((stats.whisperCount / total) * 100);
          const normalPct = Math.round((stats.normalCount / total) * 100);
          const loudPct = Math.round((stats.loudCount / total) * 100);
          const shoutPct = Math.round((stats.shoutCount / total) * 100);
          
          return (
            <View key={stats.buildingId} className={styles.sensitivityBlock}>
              <View className={styles.sensitivityHeader}>
                <View
                  className={styles.sensitivityDot}
                  style={{ backgroundColor: color.primary }}
                />
                <Text className={styles.sensitivityBuilding}>{stats.buildingName}</Text>
              </View>
              <View className={styles.sensitivityBar}>
                {whisperPct > 0 && (
                  <View
                    className={styles.sensitivitySegment}
                    style={{ width: `${whisperPct}%`, background: SENSITIVITY_COLORS.whisper.bar }}
                  >
                    <Text className={styles.segmentText}>{whisperPct}%</Text>
                  </View>
                )}
                {normalPct > 0 && (
                  <View
                    className={styles.sensitivitySegment}
                    style={{ width: `${normalPct}%`, background: SENSITIVITY_COLORS.normal.bar }}
                  >
                    <Text className={styles.segmentText}>{normalPct}%</Text>
                  </View>
                )}
                {loudPct > 0 && (
                  <View
                    className={styles.sensitivitySegment}
                    style={{ width: `${loudPct}%`, background: SENSITIVITY_COLORS.loud.bar }}
                  >
                    <Text className={styles.segmentText}>{loudPct}%</Text>
                  </View>
                )}
                {shoutPct > 0 && (
                  <View
                    className={styles.sensitivitySegment}
                    style={{ width: `${shoutPct}%`, background: SENSITIVITY_COLORS.shout.bar }}
                  >
                    <Text className={styles.segmentText}>{shoutPct}%</Text>
                  </View>
                )}
              </View>
              <View className={styles.sensitivityLegend}>
                {Object.entries(SENSITIVITY_CONFIG).map(([key, config]) => (
                  <View key={key} className={styles.legendMiniItem}>
                    <View
                      className={styles.legendMiniColor}
                      style={{ backgroundColor: SENSITIVITY_COLORS[key]?.bg || '#999' }}
                    />
                    <Text className={styles.legendMiniText}>{config.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {getAdviceText() && (
        <View className={styles.adviceSection}>
          <View className={styles.adviceHeader}>
            <Text className={styles.adviceIcon}>💡</Text>
            <Text className={styles.adviceTitle}>改造建议</Text>
          </View>
          <Text className={styles.adviceText}>{getAdviceText()}</Text>
        </View>
      )}

      <View className={styles.actionButtons}>
        <Button className={styles.secondaryBtn} onClick={handleReSelect}>
          重新选择楼栋
        </Button>
        <Button className={styles.primaryBtn} onClick={handleBackToHome}>
          返回首页
        </Button>
      </View>
    </ScrollView>
  );
};

export default CompareResultPage;
