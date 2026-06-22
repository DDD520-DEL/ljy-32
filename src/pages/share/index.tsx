import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Button, ScrollView, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classNames from 'classnames';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import { SENSITIVITY_CONFIG, REPAIR_STATUS_CONFIG, RepairStatus, ComplaintRecord, PropertyFeedback, ComplaintStatus, UNKNOWN_BRAND } from '../../types';
import ComplaintTimeline from '../../components/ComplaintTimeline';
import FeedbackModal from '../../components/FeedbackModal';

const SharePage: React.FC = () => {
  const {
    currentBuildingId,
    getCurrentBuilding,
    getRecordsByCurrentBuilding,
    getRankList,
    getRepairRecordsByBuilding,
    getRepairRecordByFloor,
    markFloorComplaint,
    updateRepairStatus,
    getComplaintRecordsByBuilding,
    addComplaintRecord,
    updateComplaintFeedback,
    updateComplaintStatus
  } = useData();

  const currentBuilding = getCurrentBuilding();
  const allRecords = getRecordsByCurrentBuilding();
  const rankList = getRankList();
  const repairRecords = currentBuildingId ? getRepairRecordsByBuilding(currentBuildingId) : [];
  const complaintRecords = currentBuildingId ? getComplaintRecordsByBuilding(currentBuildingId) : [];

  const [, forceUpdate] = useState(0);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [currentComplaintRecord, setCurrentComplaintRecord] = useState<ComplaintRecord | null>(null);

  useDidShow(() => {
    console.log('[SharePage] did show');
    forceUpdate(prev => prev + 1);
  });

  const poorFloors = useMemo(() => {
    return rankList.filter(r => r.grade === 'poor').sort((a, b) => a.averageScore - b.averageScore);
  }, [rankList]);

  const getFloorIssues = (floor: number): string => {
    const floorRecords = allRecords.filter(r => r.floor === floor);
    if (floorRecords.length === 0) return '';

    const issues: string[] = [];
    const avgSensitivity = floorRecords.reduce((sum, r) => sum + r.sensitivityScore, 0) / floorRecords.length;
    const avgDuration = floorRecords.reduce((sum, r) => sum + r.duration, 0) / floorRecords.length;
    const hasBlindSpot = floorRecords.some(r => r.hasBlindSpot);

    if (avgSensitivity < 50) {
      issues.push('灵敏度差');
    }
    if (avgDuration < 20 || avgDuration > 90) {
      issues.push('时长不合理');
    }
    if (hasBlindSpot) {
      issues.push('存在盲区');
    }

    return issues.join('、');
  };

  const getFloorPhotos = (floor: number): string[] => {
    const floorRecords = allRecords.filter(r => r.floor === floor);
    const photos: string[] = [];
    floorRecords.forEach(record => {
      if (record.photos && record.photos.length > 0) {
        photos.push(...record.photos);
      }
    });
    return photos;
  };

  const getFloorLightInfo = (floor: number): { brand: string; model: string } => {
    const floorRecords = allRecords.filter(r => r.floor === floor);
    if (floorRecords.length === 0) return { brand: '', model: '' };

    const brandCount = new Map<string, number>();
    const modelCount = new Map<string, number>();

    floorRecords.forEach(record => {
      if (record.lightBrand?.trim()) {
        const b = record.lightBrand.trim();
        brandCount.set(b, (brandCount.get(b) || 0) + 1);
      }
      if (record.lightModel?.trim()) {
        const m = record.lightModel.trim();
        modelCount.set(m, (modelCount.get(m) || 0) + 1);
      }
    });

    let brand = '';
    let model = '';
    let brandMax = 0;
    brandCount.forEach((count, b) => {
      if (count > brandMax) {
        brandMax = count;
        brand = b;
      }
    });

    let modelMax = 0;
    modelCount.forEach((count, m) => {
      if (count > modelMax) {
        modelMax = count;
        model = m;
      }
    });

    return { brand, model };
  };

  const handlePreviewImage = useCallback((photos: string[], index: number) => {
    Taro.previewImage({
      current: photos[index],
      urls: photos
    });
  }, []);

  const generateComplaintText = useMemo(() => {
    if (!currentBuilding || poorFloors.length === 0) {
      return '';
    }

    const today = new Date();
    const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

    let text = `【楼道声控灯问题投诉】\n\n`;
    text += `尊敬的物业您好：\n\n`;
    text += `我们是${currentBuilding.address}${currentBuilding.name}的业主。近期我们对本楼栋各楼层的声控灯进行了详细测试，发现以下楼层的声控灯存在严重问题，急需维修或更换：\n\n`;

    const involvedBrands = new Set<string>();

    poorFloors.forEach((floorItem, index) => {
      const issues = getFloorIssues(floorItem.floor);
      const floorRecords = allRecords.filter(r => r.floor === floorItem.floor);
      const latestRecord = floorRecords.sort(
        (a, b) => new Date(b.testTime).getTime() - new Date(a.testTime).getTime()
      )[0];
      const floorPhotos = getFloorPhotos(floorItem.floor);
      const lightInfo = getFloorLightInfo(floorItem.floor);

      text += `${index + 1}. ${floorItem.floor}楼（综合评分：${floorItem.averageScore}分）\n`;
      text += `   问题：${issues}\n`;
      if (lightInfo.brand || lightInfo.model) {
        const brandText = lightInfo.brand ? lightInfo.brand : UNKNOWN_BRAND;
        const modelText = lightInfo.model ? `，型号：${lightInfo.model}` : '';
        text += `   - 灯具品牌：${brandText}${modelText}\n`;
        if (lightInfo.brand) {
          involvedBrands.add(lightInfo.brand);
        }
      }
      if (latestRecord) {
        const sens = SENSITIVITY_CONFIG[latestRecord.sensitivityLevel];
        text += `   - 灵敏度：${sens.label}（${sens.description}）\n`;
        text += `   - 亮灯时长：${latestRecord.duration}秒\n`;
        if (latestRecord.hasBlindSpot && latestRecord.blindSpotDescription) {
          text += `   - 盲区位置：${latestRecord.blindSpotDescription}\n`;
        }
      }
      text += `   - 测试次数：${floorItem.testCount}次\n`;
      if (floorPhotos.length > 0) {
        text += `   - 现场照片：${floorPhotos.length}张\n`;
      }
      text += `\n`;
    });

    if (involvedBrands.size > 0) {
      text += `※ 本次投诉涉及灯具品牌：${Array.from(involvedBrands).join('、')}。\n`;
      text += `  建议物业在更换时优先考虑性能更稳定的品牌型号。\n\n`;
    }

    const totalPhotos = poorFloors.reduce((sum, item) => sum + getFloorPhotos(item.floor).length, 0);
    if (totalPhotos > 0) {
      text += `※ 共${totalPhotos}张现场照片将随本投诉一并发送，请关注图片消息。\n\n`;
    }

    text += `以上问题严重影响业主夜间出行安全，尤其是老人和小孩的安全。根据《物业管理条例》，声控灯属于公共设施，物业有责任进行维护和更换。\n\n`;
    text += `恳请物业尽快安排人员进行检查和维修，对于严重老化的声控灯建议直接更换为新型节能声控灯。\n\n`;
    text += `期待物业的积极回应和处理！\n\n`;
    text += `${currentBuilding.name}业主\n`;
    text += `${dateStr}`;

    return text;
  }, [currentBuilding, poorFloors, allRecords]);

  const handleCopy = async () => {
    if (!generateComplaintText) {
      Taro.showToast({ title: '暂无需要投诉的内容', icon: 'none' });
      return;
    }

    try {
      await Taro.setClipboardData({
        data: generateComplaintText
      });
    } catch (e) {
      console.error('[SharePage] 复制失败:', e);
      Taro.showToast({ title: '复制失败，请重试', icon: 'none' });
      return;
    }

    if (currentBuildingId && currentBuilding) {
      const allPhotos: string[] = [];
      poorFloors.forEach(item => {
        allPhotos.push(...getFloorPhotos(item.floor));
      });

      addComplaintRecord({
        buildingId: currentBuildingId,
        buildingName: currentBuilding.name,
        complaintText: generateComplaintText,
        complaintTime: new Date().toISOString(),
        poorFloors: poorFloors.map(f => f.floor),
        photoCount: allPhotos.length,
        status: 'pending'
      });

      if (allPhotos.length > 0) {
        Taro.showModal({
          title: '文案已复制',
          content: `投诉文案已复制到剪贴板，已自动记录本次投诉。还有${allPhotos.length}张现场照片，保存到相册后可在微信群里一并发送，让物业直观看到问题。是否现在保存照片？`,
          confirmText: '保存照片',
          cancelText: '暂不需要',
          success: async (res) => {
            if (res.confirm) {
              await handleSavePhotosToAlbum(allPhotos);
            }
            forceUpdate(prev => prev + 1);
          }
        });
      } else {
        Taro.showToast({ title: '已复制并记录投诉', icon: 'success' });
        forceUpdate(prev => prev + 1);
      }
    } else {
      Taro.showToast({ title: '已复制到剪贴板', icon: 'success' });
    }
    console.log('[SharePage] 文案已复制');
  };

  const handleAddFeedback = (record: ComplaintRecord) => {
    setCurrentComplaintRecord(record);
    setFeedbackModalVisible(true);
  };

  const handleFeedbackSubmit = (feedback: PropertyFeedback, status: ComplaintStatus) => {
    if (!currentComplaintRecord) return;
    updateComplaintFeedback(currentComplaintRecord.id, feedback);
    if (status !== 'replied') {
      updateComplaintStatus(currentComplaintRecord.id, status);
    }
    setCurrentComplaintRecord(null);
    forceUpdate(prev => prev + 1);
    Taro.showToast({ title: '反馈已保存', icon: 'success' });
  };

  const handleViewDetail = (record: ComplaintRecord) => {
    Taro.showModal({
      title: '投诉详情',
      content: record.complaintText,
      showCancel: false,
      confirmText: '关闭'
    });
  };

  const handleSavePhotosToAlbum = async (photos: string[]) => {
    if (photos.length === 0) {
      Taro.showToast({ title: '暂无照片可保存', icon: 'none' });
      return;
    }

    Taro.showLoading({ title: '保存照片中...' });
    let savedCount = 0;

    for (const photo of photos) {
      try {
        await Taro.saveImageToPhotosAlbum({ filePath: photo });
        savedCount++;
      } catch (e: any) {
        if (e?.errMsg?.includes('auth') || e?.errMsg?.includes('deny')) {
          Taro.hideLoading();
          Taro.showModal({
            title: '需要相册权限',
            content: '请在设置中允许访问相册，以便保存现场照片',
            success: (res) => {
              if (res.confirm) {
                Taro.openSetting();
              }
            }
          });
          return;
        }
        console.error('[SharePage] saveImageToPhotosAlbum error:', e);
      }
    }

    Taro.hideLoading();
    if (savedCount > 0) {
      Taro.showToast({ title: `已保存${savedCount}张照片到相册`, icon: 'success' });
    } else {
      Taro.showToast({ title: '保存失败，请检查相册权限', icon: 'none' });
    }
  };

  const handleMarkComplaint = (floor: number) => {
    if (!currentBuildingId) return;
    const issues = getFloorIssues(floor);
    Taro.showModal({
      title: '确认标记',
      content: `确认已向物业投诉${floor}楼的声控灯问题？`,
      success: (res) => {
        if (res.confirm) {
          markFloorComplaint(currentBuildingId, floor, issues);
          forceUpdate(prev => prev + 1);
          Taro.showToast({ title: '已标记投诉', icon: 'success' });
        }
      }
    });
  };

  const handleChangeStatus = (floor: number) => {
    if (!currentBuildingId) return;
    const record = getRepairRecordByFloor(currentBuildingId, floor);
    if (!record) return;

    const statusList: RepairStatus[] = ['pending', 'dispatched', 'repairing', 'fixed'];
    const statusLabels = statusList.map(s => `${REPAIR_STATUS_CONFIG[s].icon} ${REPAIR_STATUS_CONFIG[s].label}`);

    Taro.showActionSheet({
      itemList: statusLabels,
      success: (res) => {
        const newStatus = statusList[res.tapIndex];
        updateRepairStatus(record.id, newStatus);
        forceUpdate(prev => prev + 1);
        Taro.showToast({ title: '状态已更新', icon: 'success' });
      }
    });
  };

  const handleGoTest = () => {
    Taro.switchTab({ url: '/pages/record/index' });
  };

  const handleViewRank = () => {
    Taro.switchTab({ url: '/pages/rank/index' });
  };

  const handleViewRepairBoard = () => {
    Taro.navigateTo({ url: '/pages/repair/index' });
  };

  return (
    <>
      <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <Text className={styles.title}>投诉与分享</Text>
        <Text className={styles.subtitle}>
          {currentBuilding ? `${currentBuilding.name} · 推动更换老旧声控灯` : '请先选择楼栋'}
        </Text>
      </View>

      {poorFloors.length > 0 ? (
        <>
          <View className={styles.warningCard}>
            <Text className={styles.warningTitle}>⚠️ 需要关注的问题</Text>
            <Text className={styles.warningDesc}>
              以下楼层的声控灯存在严重问题，建议尽快向物业投诉，要求维修或更换。
              老旧损坏的声控灯会严重影响夜间出行安全。
            </Text>
          </View>

          <View className={styles.statsRow}>
            <View className={styles.statCard}>
              <Text className={styles.statValue}>{poorFloors.length}</Text>
              <Text className={styles.statLabel}>待更换楼层</Text>
            </View>
            <View className={styles.statCard}>
              <Text className={styles.statValue}>{allRecords.length}</Text>
              <Text className={styles.statLabel}>测试记录</Text>
            </View>
          </View>

          <Text className={styles.sectionTitle}>📋 问题楼层列表</Text>
          <View className={styles.poorFloorsList}>
            {poorFloors.map(item => {
              const repairRecord = currentBuildingId
                ? getRepairRecordByFloor(currentBuildingId, item.floor)
                : undefined;
              const statusConfig = repairRecord ? REPAIR_STATUS_CONFIG[repairRecord.status] : null;

              const floorPhotos = getFloorPhotos(item.floor);

              const lightInfo = getFloorLightInfo(item.floor);

              return (
                <View key={`${item.buildingName}-${item.floor}`} className={styles.poorFloorItem}>
                  <View className={styles.floorInfo}>
                    <View className={styles.floorHeader}>
                      <Text className={styles.floorNumber}>{item.floor}楼</Text>
                      {repairRecord?.complaintMarked && (
                        <View className={styles.complaintBadge}>
                          <Text>✓ 已投诉</Text>
                        </View>
                      )}
                    </View>
                    <Text className={styles.floorIssues}>{getFloorIssues(item.floor)}</Text>
                    {(lightInfo.brand || lightInfo.model) && (
                      <Text className={styles.floorBrand}>
                        💡 {lightInfo.brand || UNKNOWN_BRAND}{lightInfo.model ? ` · ${lightInfo.model}` : ''}
                      </Text>
                    )}
                    {floorPhotos.length > 0 && (
                      <View className={styles.floorPhotos}>
                        {floorPhotos.slice(0, 4).map((photo, idx) => (
                          <Image
                            key={idx}
                            className={styles.floorPhoto}
                            src={photo}
                            mode="aspectFill"
                            onClick={() => handlePreviewImage(floorPhotos, idx)}
                          />
                        ))}
                        {floorPhotos.length > 4 && (
                          <View className={styles.floorPhotoMore} onClick={() => handlePreviewImage(floorPhotos, 0)}>
                            <Text className={styles.floorPhotoMoreText}>+{floorPhotos.length - 4}</Text>
                          </View>
                        )}
                      </View>
                    )}
                    {statusConfig && (
                      <View
                        className={classNames(styles.statusBadge, styles[`status-${repairRecord!.status}`])}
                        onClick={() => handleChangeStatus(item.floor)}
                      >
                        <Text>{statusConfig.icon} {statusConfig.label}</Text>
                      </View>
                    )}
                  </View>
                  <View className={styles.floorActions}>
                    <Text className={styles.floorScore}>{item.averageScore}分</Text>
                    {!repairRecord?.complaintMarked ? (
                      <Button
                        className={styles.markBtn}
                        onClick={(e) => {
                          e.stopPropagation && e.stopPropagation();
                          handleMarkComplaint(item.floor);
                        }}
                      >
                        标记已投诉
                      </Button>
                    ) : (
                      <Button
                        className={classNames(styles.markBtn, styles.statusBtn)}
                        onClick={(e) => {
                          e.stopPropagation && e.stopPropagation();
                          handleChangeStatus(item.floor);
                        }}
                      >
                        更新状态
                      </Button>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <Text className={styles.sectionTitle}>✉️ 投诉文案（一键复制）</Text>
          <View className={styles.complaintContent}>
            <View className={styles.contentHeader}>
              <Text style={{ fontSize: '28rpx', fontWeight: '600', color: '#1E293B' }}>
                生成的投诉文案
              </Text>
              <Button className={styles.copyBtn} onClick={handleCopy}>
                一键复制
              </Button>
            </View>
            <ScrollView scrollY style={{ maxHeight: '600rpx' }}>
              <Text className={styles.textContent}>{generateComplaintText}</Text>
            </ScrollView>
          </View>

          <View className={styles.actionButtons}>
            <Button className={styles.actionBtn + ' ' + styles.primary} onClick={handleCopy}>
              复制文案发物业群
            </Button>
            {poorFloors.reduce((sum, item) => sum + getFloorPhotos(item.floor).length, 0) > 0 && (
              <Button
                className={styles.actionBtn + ' ' + styles.photoBtn}
                onClick={() => {
                  const allPhotos: string[] = [];
                  poorFloors.forEach(item => {
                    allPhotos.push(...getFloorPhotos(item.floor));
                  });
                  handleSavePhotosToAlbum(allPhotos);
                }}
              >
                📷 保存现场照片到相册
              </Button>
            )}
            <Button className={styles.actionBtn + ' ' + styles.repairBtn} onClick={handleViewRepairBoard}>
              🔧 查看维修看板
            </Button>
            <Button className={styles.actionBtn + ' ' + styles.secondary} onClick={handleViewRank}>
              查看完整排行榜
            </Button>
          </View>

          <View className={styles.tips}>
            <Text className={styles.tipsTitle}>💡 使用提示</Text>
            <Text className={styles.tipsText}>
              1. 点击"复制文案发物业群"复制投诉文案{'\n'}
              2. 弹窗提示时点击"保存照片"，将现场照片保存到手机相册{'\n'}
              3. 打开微信物业群，粘贴文案后再逐张发送照片{'\n'}
              4. 照片证据+测试数据一起发，更有说服力{'\n'}
              5. 持续记录，跟踪物业处理进度
            </Text>
          </View>

          <View className={styles.timelineSection}>
            <ComplaintTimeline
              records={complaintRecords}
              onAddFeedback={handleAddFeedback}
              onViewDetail={handleViewDetail}
            />
          </View>
        </>
      ) : (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>🎉</Text>
          <Text className={styles.emptyText}>太棒了！暂无需要投诉的楼层</Text>
          <Text className={styles.emptyHint}>
            快去测试更多楼层，收集数据推动问题解决吧！
          </Text>
          <View className={styles.actionButtons}>
            <Button className={styles.actionBtn + ' ' + styles.primary} onClick={handleGoTest}>
              开始测试
            </Button>
            <Button className={styles.actionBtn + ' ' + styles.secondary} onClick={handleViewRank}>
              查看排行榜
            </Button>
          </View>
        </View>
      )}

      {complaintRecords.length > 0 && (
        <View className={styles.timelineSection}>
          <ComplaintTimeline
            records={complaintRecords}
            onAddFeedback={handleAddFeedback}
            onViewDetail={handleViewDetail}
          />
        </View>
      )}
    </ScrollView>

      <FeedbackModal
        visible={feedbackModalVisible}
        initialFeedback={currentComplaintRecord?.feedback}
        initialStatus={currentComplaintRecord?.status}
        onClose={() => setFeedbackModalVisible(false)}
        onSubmit={handleFeedbackSubmit}
      />
    </>
  );
};

export default SharePage;
