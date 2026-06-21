import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Canvas, Button } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage, useShareTimeline, useRouter } from '@tarojs/taro';
import styles from './index.module.scss';
import { useData } from '../../store/DataContext';
import type { ReportType, ReportData, SensitivityLevel, FloorIssueChange } from '../../types';
import { SENSITIVITY_CONFIG, GRADE_CONFIG } from '../../types';
import { formatReportDate, formatReportDateTime } from '../../utils/reportUtils';

const COLORS = {
  whisper: '#10B981',
  normal: '#3B82F6',
  loud: '#F59E0B',
  shout: '#EF4444',
  rankGold: '#F59E0B',
  rankSilver: '#94A3B8',
  rankBronze: '#CD7F32'
};

const GRADE_LABELS = {
  excellent: '优秀',
  good: '良好',
  poor: '较差',
  none: '无数据'
};

const CANVAS_WIDTH = 750;
const PADDING = 40;
const CARD_GAP = 25;
const CARD_CONTENT_PAD = 30;

const ReportPage: React.FC = () => {
  const router = useRouter();
  const { getReportData, getCurrentBuilding } = useData();
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const typeParam = router.params?.type;
    if (typeParam === 'weekly' || typeParam === 'monthly') {
      setReportType(typeParam);
    }
  }, [router.params]);

  const report = useMemo<ReportData | null>(() => {
    return getReportData(reportType);
  }, [reportType, getReportData]);

  useDidShow(() => {
    console.log('[ReportPage] did show, reportType:', reportType, 'hasReport:', !!report);
  });

  useShareAppMessage(() => {
    const building = getCurrentBuilding();
    return {
      title: `${building?.name || '楼栋'} ${report?.periodLabel || ''} 声控灯测试简报`,
      path: `/pages/report/index?type=${reportType}`
    };
  });

  useShareTimeline(() => {
    const building = getCurrentBuilding();
    return {
      title: `${building?.name || '楼栋'} 声控灯测试简报`,
      query: `type=${reportType}`
    };
  });

  const handleShare = useCallback(() => {
    Taro.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
    Taro.showToast({ title: '点击右上角分享', icon: 'none' });
  }, []);

  const handleSaveImage = useCallback(async () => {
    if (!report) {
      Taro.showToast({ title: '暂无数据可保存', icon: 'none' });
      return;
    }

    try {
      const setting = await Taro.getSetting();
      if (setting.authSetting && setting.authSetting['scope.writePhotosAlbum'] === false) {
        Taro.showModal({
          title: '需要相册权限',
          content: '需要相册权限才能保存图片，请在设置中开启',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              Taro.openSetting();
            }
          }
        });
        return;
      }
    } catch (e) {
      console.warn('[Report] getSetting error:', e);
    }

    setIsSaving(true);

    try {
      const canvasId = 'reportCanvas';
      const query = Taro.createSelectorQuery();
      query.select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec(async (res) => {
          try {
            if (!res || !res[0] || !res[0].node) {
              throw new Error('Canvas 节点未找到');
            }

            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Canvas 上下文获取失败');
            }

            const dpr = Taro.getSystemInfoSync().pixelRatio || 2;
            const contentHeight = calculateReportHeight(report, CANVAS_WIDTH);
            const canvasHeight = contentHeight;

            canvas.width = CANVAS_WIDTH * dpr;
            canvas.height = canvasHeight * dpr;
            ctx.scale(dpr, dpr);

            console.log('[Report] canvas size:', CANVAS_WIDTH, 'x', canvasHeight, 'dpr:', dpr);

            drawReport(ctx, report, CANVAS_WIDTH, canvasHeight);

            setTimeout(() => {
              Taro.canvasToTempFilePath({
                canvas,
                canvasId,
                x: 0,
                y: 0,
                width: CANVAS_WIDTH,
                height: canvasHeight,
                destWidth: CANVAS_WIDTH * dpr,
                destHeight: canvasHeight * dpr,
                fileType: 'png',
                quality: 1,
                success: (tempRes) => {
                  const tempPath = tempRes.tempFilePath;
                  console.log('[Report] tempPath:', tempPath);

                  Taro.saveImageToPhotosAlbum({
                    filePath: tempPath,
                    success: () => {
                      Taro.showToast({ title: '已保存到相册', icon: 'success' });
                      setIsSaving(false);
                    },
                    fail: (saveErr) => {
                      console.warn('[Report] saveImage fail:', saveErr);
                      if (saveErr.errMsg?.includes('auth') || saveErr.errMsg?.includes('authorize')) {
                        Taro.showModal({
                          title: '需要相册权限',
                          content: '请在设置中开启保存到相册的权限，即可保存图片分享',
                          confirmText: '去设置',
                          success: (modalRes) => {
                            if (modalRes.confirm) {
                              Taro.openSetting();
                            }
                            setIsSaving(false);
                          }
                        });
                      } else {
                        Taro.previewImage({
                          urls: [tempPath],
                          current: tempPath
                        });
                        Taro.showToast({ title: '长按图片可保存', icon: 'none' });
                        setIsSaving(false);
                      }
                    }
                  });
                },
                fail: (err) => {
                  console.error('[Report] canvasToTempFilePath fail:', err);
                  Taro.showToast({ title: '生成图片失败', icon: 'none' });
                  setIsSaving(false);
                }
              });
            }, 300);
          } catch (e) {
            console.error('[Report] draw error:', e);
            Taro.showToast({ title: '生成图片失败', icon: 'none' });
            setIsSaving(false);
          }
        });
    } catch (e) {
      console.error('[Report] save image error:', e);
      Taro.showToast({ title: '保存失败', icon: 'none' });
      setIsSaving(false);
    }
  }, [report]);

  const calculateReportHeight = (data: ReportData, width: number): number => {
    const padding = PADDING;
    let y = 0;

    y += 60;
    y += calcHeaderHeight(data, width, padding);
    y += CARD_GAP;
    y += calcStatsHeight(data, width, padding);
    y += CARD_GAP;
    y += calcTrendHeight(data, width, padding);
    y += CARD_GAP;
    y += calcSensitivityAndGradeHeight(data, width, padding);
    y += CARD_GAP;
    y += calcFloorChangesHeight(data, width, padding);
    y += CARD_GAP;
    y += calcRankSectionHeight(data, width, padding);

    if (data.blindSpotCount > 0) {
      y += CARD_GAP;
      y += calcBlindSpotHeight(data, width, padding);
    }

    y += CARD_GAP;
    y += calcContributorsHeight(data, width, padding);
    y += CARD_GAP;

    y += 60;

    y += 100;
    return y;
  };

  const calcCardHeight = (contentHeight: number): number => {
    return contentHeight + CARD_CONTENT_PAD * 2;
  };

  const calcSectionTitleHeight = (): number => 30;

  const calcHeaderHeight = (_data: ReportData, _width: number, _padding: number): number => {
    return calcCardHeight(200);
  };

  const calcStatsHeight = (_data: ReportData, _width: number, _padding: number): number => {
    return calcCardHeight(calcSectionTitleHeight() + 20 + 2 * 115);
  };

  const calcTrendHeight = (_data: ReportData, _width: number, _padding: number): number => {
    return calcCardHeight(calcSectionTitleHeight() + 20 + 270);
  };

  const calcSensitivityAndGradeHeight = (_data: ReportData, _width: number, _padding: number): number => {
    const sensHeight = 4 * 48;
    const gradeHeight = 140;
    return calcCardHeight(2 * calcSectionTitleHeight() + 30 + sensHeight + gradeHeight);
  };

  const calcFloorChangesHeight = (data: ReportData, _width: number, _padding: number): number => {
    const count = Math.min(
      data.declinedFloors.length + data.improvedFloors.length + data.newFloors.length,
      6
    );
    if (count === 0) {
      return calcCardHeight(calcSectionTitleHeight() + 20 + 80);
    }
    return calcCardHeight(calcSectionTitleHeight() + 10 + count * 58);
  };

  const calcRankSectionHeight = (data: ReportData, _width: number, _padding: number): number => {
    const maxCount = Math.max(data.topFloors.length, data.bottomFloors.length, 1);
    const listHeight = 30 + maxCount * 50;
    return calcCardHeight(calcSectionTitleHeight() + 10 + listHeight);
  };

  const calcBlindSpotHeight = (_data: ReportData, _width: number, _padding: number): number => {
    return calcCardHeight(calcSectionTitleHeight() + 20 + 100);
  };

  const calcContributorsHeight = (data: ReportData, _width: number, _padding: number): number => {
    if (data.contributors.length === 0) {
      return calcCardHeight(calcSectionTitleHeight() + 20 + 80);
    }
    return calcCardHeight(calcSectionTitleHeight() + 10 + data.contributors.length * 58);
  };

  const drawReport = (
    ctx: CanvasRenderingContext2D,
    data: ReportData,
    width: number,
    _height: number
  ) => {
    const padding = PADDING;
    let y = 30;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, _height);

    drawBackground(ctx, width);

    y += 30;
    y = drawHeader(ctx, data, width, padding, y);
    y += CARD_GAP;
    y = drawStats(ctx, data, width, padding, y);
    y += CARD_GAP;
    y = drawTrend(ctx, data, width, padding, y);
    y += CARD_GAP;
    y = drawSensitivityAndGrade(ctx, data, width, padding, y);
    y += CARD_GAP;
    y = drawFloorChanges(ctx, data, width, padding, y);
    y += CARD_GAP;
    y = drawRankSection(ctx, data, width, padding, y);

    if (data.blindSpotCount > 0) {
      y += CARD_GAP;
      y = drawBlindSpot(ctx, data, width, padding, y);
    }

    y += CARD_GAP;
    y = drawContributors(ctx, data, width, padding, y);

    drawFooter(ctx, width, y + 20);
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, width: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(255, 107, 53, 0.12)');
    gradient.addColorStop(1, 'rgba(255, 107, 53, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, 300);
  };

  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const drawCardBg = (
    ctx: CanvasRenderingContext2D,
    width: number,
    padding: number,
    y: number,
    height: number
  ) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    drawRoundedRect(ctx, padding, y, width - padding * 2, height, 20);
    ctx.fill();
    ctx.shadowColor = 'transparent';
  };

  const drawSectionTitle = (
    ctx: CanvasRenderingContext2D,
    icon: string,
    title: string,
    padding: number,
    y: number
  ): number => {
    ctx.font = 'bold 28px system-ui';
    ctx.fillStyle = '#1E293B';
    ctx.fillText(`${icon}  ${title}`, padding + CARD_CONTENT_PAD, y);
    return y + 30;
  };

  const drawHeader = (
    ctx: CanvasRenderingContext2D,
    data: ReportData,
    width: number,
    padding: number,
    y: number
  ): number => {
    const cardH = 200 + CARD_CONTENT_PAD * 2;
    drawCardBg(ctx, width, padding, y, cardH);
    let cy = y + CARD_CONTENT_PAD;

    ctx.font = 'bold 40px system-ui';
    ctx.fillStyle = '#1E293B';
    ctx.fillText(data.buildingName, padding + CARD_CONTENT_PAD, cy + 10);
    cy += 50;

    ctx.font = '22px system-ui';
    ctx.fillStyle = '#64748B';
    ctx.fillText(`${data.address} · 共${data.totalFloors}层`, padding + CARD_CONTENT_PAD, cy + 10);
    cy += 40;

    const tagW = 380;
    const tagH = 44;
    const gradient = ctx.createLinearGradient(padding + CARD_CONTENT_PAD, 0, padding + CARD_CONTENT_PAD + tagW, 0);
    gradient.addColorStop(0, '#FF6B35');
    gradient.addColorStop(1, '#FF8C5A');
    ctx.fillStyle = gradient;
    drawRoundedRect(ctx, padding + CARD_CONTENT_PAD, cy, tagW, tagH, 22);
    ctx.fill();

    ctx.font = 'bold 22px system-ui';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(data.periodLabel, padding + CARD_CONTENT_PAD + tagW / 2, cy + 30);
    ctx.textAlign = 'left';
    cy += 60;

    ctx.font = '18px system-ui';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`生成时间: ${formatReportDateTime(data.generateTime)}`, padding + CARD_CONTENT_PAD, cy + 10);

    return y + cardH;
  };

  const drawStats = (
    ctx: CanvasRenderingContext2D,
    data: ReportData,
    width: number,
    padding: number,
    y: number
  ): number => {
    const cardH = calcCardHeight(30 + 20 + 2 * 115);
    drawCardBg(ctx, width, padding, y, cardH);
    let cy = y + CARD_CONTENT_PAD;

    cy = drawSectionTitle(ctx, '📊', '核心数据', padding, cy);
    cy += 20;

    const stats = [
      { label: '新增测试', value: data.newTestCount, change: data.testCountChange, color: '#FF6B35', unit: '次' },
      { label: '覆盖楼层', value: data.testedFloors, change: data.testedFloors - data.testedFloorsPrev, color: '#3B82F6', unit: '层' },
      { label: '平均得分', value: data.avgScore, change: data.avgScoreChange, color: data.avgScore >= 70 ? '#10B981' : data.avgScore >= 50 ? '#F59E0B' : '#EF4444', unit: '分' },
      { label: '待改进', value: data.poorCount, change: data.poorCount - data.poorCountPrev, color: '#EF4444', unit: '次' }
    ];

    const cellW = (width - padding * 2 - CARD_CONTENT_PAD * 2 - 20) / 2;
    const cellH = 100;

    stats.forEach((stat, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx = padding + CARD_CONTENT_PAD + col * (cellW + 20);
      const ccy = cy + row * (cellH + 15);

      ctx.fillStyle = '#F8FAFC';
      drawRoundedRect(ctx, cx, ccy, cellW, cellH, 14);
      ctx.fill();

      ctx.font = '20px system-ui';
      ctx.fillStyle = '#64748B';
      ctx.fillText(stat.label, cx + 18, ccy + 32);

      ctx.font = 'bold 38px system-ui';
      ctx.fillStyle = stat.color;
      ctx.fillText(String(stat.value), cx + 18, ccy + 76);

      const changeText = stat.change > 0 ? `↑${stat.change}` : stat.change < 0 ? `↓${Math.abs(stat.change)}` : '—';
      const changeColor = stat.change > 0 ? '#10B981' : stat.change < 0 ? '#EF4444' : '#94A3B8';
      ctx.font = '18px system-ui';
      ctx.fillStyle = changeColor;
      const textLen = ctx.measureText(changeText).width;
      ctx.fillText(changeText, cx + cellW - textLen - 18, ccy + 32);

      ctx.font = '16px system-ui';
      ctx.fillStyle = '#94A3B8';
      const unitLen = ctx.measureText(stat.unit).width;
      ctx.fillText(stat.unit, cx + cellW - unitLen - 18, ccy + 76);
    });

    return y + cardH;
  };

  const drawTrend = (
    ctx: CanvasRenderingContext2D,
    data: ReportData,
    width: number,
    padding: number,
    y: number
  ): number => {
    const trend = data.sensitivityTrend;
    const cardH = calcCardHeight(30 + 20 + 270);
    drawCardBg(ctx, width, padding, y, cardH);
    let cy = y + CARD_CONTENT_PAD;

    cy = drawSectionTitle(ctx, '📈', '灵敏度变化趋势', padding, cy);
    cy += 20;

    const chartX = padding + CARD_CONTENT_PAD;
    const chartW = width - padding * 2 - CARD_CONTENT_PAD * 2;
    const chartH = 220;
    const chartY = cy;

    ctx.fillStyle = '#F8FAFC';
    drawRoundedRect(ctx, chartX, chartY, chartW, chartH + 50, 14);
    ctx.fill();

    if (trend && trend.length > 0) {
      const barGap = 12;
      const barWidth = Math.min(40, (chartW - 40 - barGap * (trend.length - 1)) / trend.length);
      const totalBarsW = barWidth * trend.length + barGap * (trend.length - 1);
      const startX = chartX + (chartW - totalBarsW) / 2;
      const maxScore = 100;

      trend.forEach((item, idx) => {
        const bx = startX + idx * (barWidth + barGap);
        const barH = item.avgScore > 0 ? Math.max(6, (item.avgScore / maxScore) * (chartH - 60)) : 0;
        const by = chartY + chartH - barH - 10;

        const gradient = ctx.createLinearGradient(0, by, 0, chartY + chartH - 10);
        gradient.addColorStop(0, '#FF6B35');
        gradient.addColorStop(1, '#FFB088');
        ctx.fillStyle = gradient;
        drawRoundedRect(ctx, bx, by, barWidth, barH, 4);
        ctx.fill();

        if (item.avgScore > 0) {
          ctx.font = 'bold 16px system-ui';
          ctx.fillStyle = '#FF6B35';
          ctx.textAlign = 'center';
          ctx.fillText(String(item.avgScore), bx + barWidth / 2, by - 8);
          ctx.textAlign = 'left';
        }

        ctx.font = '16px system-ui';
        ctx.fillStyle = '#94A3B8';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, bx + barWidth / 2, chartY + chartH + 28);
        ctx.textAlign = 'left';
      });
    }

    return y + cardH;
  };

  const drawSensitivityAndGrade = (
    ctx: CanvasRenderingContext2D,
    data: ReportData,
    width: number,
    padding: number,
    y: number
  ): number => {
    const levels: SensitivityLevel[] = ['whisper', 'normal', 'loud', 'shout'];
    const total = Object.values(data.sensitivityLevelDist).reduce((a, b) => a + b, 0) || 1;

    const sensHeight = levels.length * 48;
    const gradeHeight = 140;
    const cardH = calcCardHeight(2 * 30 + 30 + sensHeight + gradeHeight);

    drawCardBg(ctx, width, padding, y, cardH);
    let cy = y + CARD_CONTENT_PAD;

    cy = drawSectionTitle(ctx, '🎚️', '灵敏度分布', padding, cy);
    cy += 16;

    levels.forEach((level, idx) => {
      const count = data.sensitivityLevelDist[level];
      const percent = (count / total) * 100;
      const config = SENSITIVITY_CONFIG[level];

      const by = cy + idx * 48;

      ctx.font = '20px system-ui';
      ctx.fillStyle = '#1E293B';
      ctx.fillText(config.label, padding + CARD_CONTENT_PAD, by + 22);

      const trackX = padding + CARD_CONTENT_PAD + 90;
      const trackW = width - padding * 2 - CARD_CONTENT_PAD * 2 - 180;
      ctx.fillStyle = '#F1F5F9';
      drawRoundedRect(ctx, trackX, by + 8, trackW, 22, 11);
      ctx.fill();

      if (percent > 0) {
        const fillW = Math.max(6, (percent / 100) * trackW);
        ctx.fillStyle = COLORS[level];
        drawRoundedRect(ctx, trackX, by + 8, fillW, 22, 11);
        ctx.fill();
      }

      ctx.font = 'bold 20px system-ui';
      ctx.fillStyle = '#1E293B';
      ctx.textAlign = 'right';
      ctx.fillText(`${count}次`, width - padding - CARD_CONTENT_PAD, by + 22);
      ctx.textAlign = 'left';
    });

    cy += sensHeight + 20;

    cy = drawSectionTitle(ctx, '🏆', '质量等级统计', padding, cy);
    cy += 16;

    const grades = [
      { key: 'excellent', label: '优秀', icon: '🌟', count: data.excellentCount, color: COLORS.rankGold },
      { key: 'good', label: '良好', icon: '👍', count: data.goodCount, color: '#3B82F6' },
      { key: 'poor', label: '待改进', icon: '⚠️', count: data.poorCount, color: '#EF4444' }
    ];

    const cellW = (width - padding * 2 - CARD_CONTENT_PAD * 2 - 20) / 3;
    grades.forEach((g, idx) => {
      const cx = padding + CARD_CONTENT_PAD + idx * (cellW + 10);

      ctx.fillStyle = '#F8FAFC';
      drawRoundedRect(ctx, cx, cy, cellW, 100, 14);
      ctx.fill();

      ctx.font = '32px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(g.icon, cx + cellW / 2, cy + 44);

      ctx.font = 'bold 32px system-ui';
      ctx.fillStyle = g.color;
      ctx.fillText(String(g.count), cx + cellW / 2, cy + 80);

      ctx.font = '18px system-ui';
      ctx.fillStyle = '#64748B';
      ctx.fillText(g.label, cx + cellW / 2, cy + 100);
      ctx.textAlign = 'left';
    });

    return y + cardH;
  };

  const drawFloorChanges = (
    ctx: CanvasRenderingContext2D,
    data: ReportData,
    width: number,
    padding: number,
    y: number
  ): number => {
    const changes: Array<FloorIssueChange & { title: string; color: string }> = [];
    data.declinedFloors.slice(0, 3).forEach(f => changes.push({ ...f, title: '下降', color: '#EF4444' }));
    data.improvedFloors.slice(0, 3).forEach(f => changes.push({ ...f, title: '提升', color: '#10B981' }));
    data.newFloors.slice(0, 2).forEach(f => changes.push({ ...f, title: '新增', color: '#FF6B35' }));

    const hasData = changes.length > 0;
    const count = hasData ? Math.min(changes.length, 6) : 1;
    const cardH = calcCardHeight(30 + 10 + (hasData ? count * 58 : 80));

    drawCardBg(ctx, width, padding, y, cardH);
    let cy = y + CARD_CONTENT_PAD;

    cy = drawSectionTitle(ctx, '🏗️', '楼层变化情况', padding, cy);
    cy += 10;

    if (!hasData) {
      ctx.font = '20px system-ui';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText('暂无楼层变化', width / 2, cy + 30);
      ctx.textAlign = 'left';
    } else {
      changes.slice(0, 6).forEach((item, idx) => {
        const ry = cy + idx * 58;

        ctx.fillStyle = '#F8FAFC';
        drawRoundedRect(ctx, padding + CARD_CONTENT_PAD, ry, width - padding * 2 - CARD_CONTENT_PAD * 2, 50, 10);
        ctx.fill();

        ctx.fillStyle = item.color;
        ctx.fillRect(padding + CARD_CONTENT_PAD, ry, 5, 50);

        ctx.font = 'bold 22px system-ui';
        ctx.fillStyle = '#1E293B';
        ctx.fillText(`${item.floor}楼`, padding + CARD_CONTENT_PAD + 20, ry + 32);

        ctx.font = '18px system-ui';
        ctx.fillStyle = '#64748B';
        const gradeText = item.prevGrade !== 'none'
          ? `${GRADE_LABELS[item.prevGrade]} → ${GRADE_LABELS[item.currGrade]}`
          : `→ ${GRADE_LABELS[item.currGrade]}`;
        ctx.fillText(gradeText, padding + CARD_CONTENT_PAD + 100, ry + 32);

        const changeText = item.scoreChange > 0 ? `+${item.scoreChange}分` : `${item.scoreChange}分`;
        ctx.font = 'bold 18px system-ui';
        ctx.fillStyle = item.color;
        ctx.textAlign = 'right';
        ctx.fillText(changeText, width - padding - CARD_CONTENT_PAD, ry + 32);
        ctx.textAlign = 'left';
      });
    }

    return y + cardH;
  };

  const drawRankSection = (
    ctx: CanvasRenderingContext2D,
    data: ReportData,
    width: number,
    padding: number,
    y: number
  ): number => {
    const maxCount = Math.max(data.topFloors.length, data.bottomFloors.length, 1);
    const listH = 30 + maxCount * 50;
    const cardH = calcCardHeight(30 + 10 + listH);

    drawCardBg(ctx, width, padding, y, cardH);
    let cy = y + CARD_CONTENT_PAD;

    cy = drawSectionTitle(ctx, '🏅', '楼层排行', padding, cy);
    cy += 10;

    const halfW = (width - padding * 2 - CARD_CONTENT_PAD * 2 - 10) / 2;

    const drawRankList = (
      list: typeof data.topFloors,
      x: number,
      title: string,
      titleColor: string
    ) => {
      ctx.font = 'bold 20px system-ui';
      ctx.fillStyle = titleColor;
      ctx.textAlign = 'center';
      ctx.fillText(title, x + halfW / 2, cy + 22);
      ctx.textAlign = 'left';

      if (list.length === 0) {
        ctx.font = '18px system-ui';
        ctx.fillStyle = '#94A3B8';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', x + halfW / 2, cy + 60);
        ctx.textAlign = 'left';
        return;
      }

      list.forEach((item, idx) => {
        const ly = cy + 40 + idx * 50;
        const colors = [COLORS.rankGold, COLORS.rankSilver, COLORS.rankBronze];
        const badgeColor = colors[idx] || '#94A3B8';

        ctx.fillStyle = badgeColor;
        ctx.beginPath();
        ctx.arc(x + 22, ly + 20, 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 14px system-ui';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1), x + 22, ly + 25);
        ctx.textAlign = 'left';

        ctx.font = '20px system-ui';
        ctx.fillStyle = '#1E293B';
        ctx.fillText(`${item.floor}楼`, x + 50, ly + 26);

        ctx.font = 'bold 18px system-ui';
        ctx.fillStyle = item.grade === 'excellent' ? '#10B981' : item.grade === 'good' ? '#F59E0B' : '#EF4444';
        ctx.textAlign = 'right';
        ctx.fillText(`${item.avgScore}分`, x + halfW - 10, ly + 26);
        ctx.textAlign = 'left';
      });
    };

    drawRankList(data.topFloors, padding + CARD_CONTENT_PAD, 'TOP 3 最佳', '#10B981');
    drawRankList(data.bottomFloors, padding + CARD_CONTENT_PAD + halfW + 10, '需关注 TOP3', '#EF4444');

    return y + cardH;
  };

  const drawBlindSpot = (
    ctx: CanvasRenderingContext2D,
    data: ReportData,
    width: number,
    padding: number,
    y: number
  ): number => {
    const cardH = calcCardHeight(30 + 20 + 100);
    drawCardBg(ctx, width, padding, y, cardH);
    let cy = y + CARD_CONTENT_PAD;

    cy = drawSectionTitle(ctx, '👁️', '盲区提醒', padding, cy);
    cy += 20;

    ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 2;
    const boxW = width - padding * 2 - CARD_CONTENT_PAD * 2;
    drawRoundedRect(ctx, padding + CARD_CONTENT_PAD, cy, boxW, 80, 12);
    ctx.fill();
    ctx.stroke();

    ctx.font = '20px system-ui';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`⚠️  检测到 ${data.blindSpotCount} 次盲区情况`, padding + CARD_CONTENT_PAD + 16, cy + 34);

    ctx.font = '18px system-ui';
    ctx.fillStyle = '#64748B';
    const floorsText = `涉及楼层: ${data.blindSpotFloors.map(f => `${f}楼`).join('、')}`;
    const lines = wrapText(floorsText, boxW - 32, 24);
    lines.forEach((line, idx) => {
      ctx.fillText(line, padding + CARD_CONTENT_PAD + 16, cy + 64 + idx * 24);
    });

    return y + cardH;
  };

  const wrapText = (text: string, maxWidth: number, _lineHeight: number): string[] => {
    const lines: string[] = [];
    let currentLine = '';
    const avgCharWidth = 11;

    for (const char of text) {
      const testLine = currentLine + char;
      const testWidth = testLine.length * avgCharWidth;
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const drawContributors = (
    ctx: CanvasRenderingContext2D,
    data: ReportData,
    width: number,
    padding: number,
    y: number
  ): number => {
    const hasData = data.contributors.length > 0;
    const count = hasData ? data.contributors.length : 1;
    const cardH = calcCardHeight(30 + 10 + (hasData ? count * 58 : 80));

    drawCardBg(ctx, width, padding, y, cardH);
    let cy = y + CARD_CONTENT_PAD;

    cy = drawSectionTitle(ctx, '👥', '贡献榜', padding, cy);
    cy += 10;

    if (!hasData) {
      ctx.font = '20px system-ui';
      ctx.fillStyle = '#94A3B8';
      ctx.textAlign = 'center';
      ctx.fillText('暂无贡献数据', width / 2, cy + 30);
      ctx.textAlign = 'left';
    } else {
      data.contributors.forEach((c, idx) => {
        const cy2 = cy + idx * 58;
        const boxW = width - padding * 2 - CARD_CONTENT_PAD * 2;

        ctx.fillStyle = '#F8FAFC';
        drawRoundedRect(ctx, padding + CARD_CONTENT_PAD, cy2, boxW, 50, 10);
        ctx.fill();

        const gradient = ctx.createLinearGradient(padding + CARD_CONTENT_PAD + 10, 0, padding + CARD_CONTENT_PAD + 50, 0);
        gradient.addColorStop(0, '#FF6B35');
        gradient.addColorStop(1, '#FF8C5A');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(padding + CARD_CONTENT_PAD + 28, cy2 + 25, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 18px system-ui';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(c.testerName.charAt(0), padding + CARD_CONTENT_PAD + 28, cy2 + 31);
        ctx.textAlign = 'left';

        ctx.font = '20px system-ui';
        ctx.fillStyle = '#1E293B';
        ctx.fillText(c.testerName, padding + CARD_CONTENT_PAD + 60, cy2 + 32);

        ctx.font = 'bold 20px system-ui';
        ctx.fillStyle = '#FF6B35';
        ctx.textAlign = 'right';
        ctx.fillText(`${c.testCount}次`, width - padding - CARD_CONTENT_PAD, cy2 + 32);
        ctx.textAlign = 'left';
      });
    }

    return y + cardH;
  };

  const drawFooter = (ctx: CanvasRenderingContext2D, width: number, y: number) => {
    ctx.font = '16px system-ui';
    ctx.fillStyle = '#CBD5E1';
    ctx.textAlign = 'center';
    ctx.fillText('—— 声控灯评测 · 让楼道更安全 ——', width / 2, y);
    ctx.textAlign = 'left';
  };

  const renderChangeBadge = (change: number) => {
    if (change > 0) {
      return <Text className={`${styles.statChange} ${styles.up}`}>↑{change}</Text>;
    }
    if (change < 0) {
      return <Text className={`${styles.statChange} ${styles.down}`}>↓{Math.abs(change)}</Text>;
    }
    return <Text className={`${styles.statChange} ${styles.flat}`}>—</Text>;
  };

  const renderFloorChangeRow = (item: FloorIssueChange, type: 'improved' | 'declined' | 'new') => (
    <View key={`${type}-${item.floor}`} className={`${styles.changeRow} ${styles[type]}`}>
      <Text className={styles.floorNum}>{item.floor}楼</Text>
      <View className={styles.floorInfo}>
        <Text className={styles.gradeChange}>
          {item.prevGrade !== 'none' && <>{GRADE_LABELS[item.prevGrade]} → </>}
          {GRADE_LABELS[item.currGrade]}
        </Text>
        <Text className={`${styles.scoreChange} ${type === 'new' ? styles.new : type === 'improved' ? styles.up : styles.down}`}>
          {type === 'new' ? `新增 +${item.scoreChange}分` : item.scoreChange > 0 ? `+${item.scoreChange}分` : `${item.scoreChange}分`}
        </Text>
      </View>
    </View>
  );

  const renderRankBadgeColor = (idx: number): string => {
    const colors = ['#F59E0B', '#94A3B8', '#CD7F32'];
    return colors[idx] || '#94A3B8';
  };

  return (
    <View className={styles.container}>
      <View className={styles.tabBar}>
        <View
          className={`${styles.tabItem} ${reportType === 'weekly' ? styles.active : ''}`}
          onClick={() => setReportType('weekly')}
        >
          📅 周报
        </View>
        <View
          className={`${styles.tabItem} ${reportType === 'monthly' ? styles.active : ''}`}
          onClick={() => setReportType('monthly')}
        >
          📆 月报
        </View>
      </View>

      {!report ? (
        <View className={styles.emptyState}>
          <Text className={styles.emptyIcon}>📊</Text>
          <Text className={styles.emptyTitle}>暂无{reportType === 'weekly' ? '本周' : '本月'}数据</Text>
          <Text className={styles.emptyDesc}>
            快去测试记录页面录入测试数据吧，{reportType === 'weekly' ? '下周' : '下月'}就能生成简报啦！
          </Text>
          <Button
            className={`${styles.actionBtn} ${styles.primary}`}
            style={{ marginTop: 32 }}
            onClick={() => Taro.switchTab({ url: '/pages/record/index' })}
          >
            去测试
          </Button>
        </View>
      ) : (
        <>
          <View className={styles.reportCard}>
            <View className={styles.reportHeader}>
              <Text className={styles.buildingName}>{report.buildingName}</Text>
              <Text className={styles.buildingInfo}>
                {report.address} · 共{report.totalFloors}层
              </Text>
              <Text className={styles.periodLabel}>{report.periodLabel}</Text>
              <Text className={styles.generateTime}>生成时间: {formatReportDateTime(report.generateTime)}</Text>
            </View>

            <Text className={styles.sectionTitle}><Text className={styles.icon}>📊</Text> 核心数据</Text>
            <View className={styles.statsGrid}>
              <View className={styles.statBox}>
                <Text className={styles.statLabel}>新增测试</Text>
                <Text className={`${styles.statValue} ${styles.primary}`}>{report.newTestCount}</Text>
                {renderChangeBadge(report.testCountChange)}
              </View>
              <View className={styles.statBox}>
                <Text className={styles.statLabel}>覆盖楼层</Text>
                <Text className={`${styles.statValue} ${styles.success}`}>{report.testedFloors}</Text>
                {renderChangeBadge(report.testedFloors - report.testedFloorsPrev)}
              </View>
              <View className={styles.statBox}>
                <Text className={styles.statLabel}>平均得分</Text>
                <Text
                  className={`${styles.statValue} ${
                    report.avgScore >= 70 ? styles.success : report.avgScore >= 50 ? styles.warning : styles.error
                  }`}
                >
                  {report.avgScore}
                </Text>
                {renderChangeBadge(report.avgScoreChange)}
              </View>
              <View className={styles.statBox}>
                <Text className={styles.statLabel}>待改进</Text>
                <Text className={`${styles.statValue} ${styles.error}`}>{report.poorCount}</Text>
                {renderChangeBadge(report.poorCount - report.poorCountPrev)}
              </View>
            </View>
          </View>

          <View className={styles.reportCard}>
            <Text className={styles.sectionTitle}><Text className={styles.icon}>📈</Text> 灵敏度变化趋势</Text>
            <View className={styles.trendChart}>
              <View className={styles.chartBars}>
                {report.sensitivityTrend.map(item => (
                  <View key={item.date} className={styles.chartBar}>
                    <View
                      className={styles.barFill}
                      style={{ height: `${item.avgScore > 0 ? Math.max(8, item.avgScore * 0.8) : 8}rpx` }}
                      data-score={item.avgScore > 0 ? item.avgScore : ''}
                    />
                    <Text className={styles.barLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View className={styles.reportCard}>
            <Text className={styles.sectionTitle}><Text className={styles.icon}>🎚️</Text> 灵敏度分布</Text>
            <View className={styles.sensitivityDist}>
              {(Object.keys(SENSITIVITY_CONFIG) as SensitivityLevel[]).map(level => {
                const total = Object.values(report.sensitivityLevelDist).reduce((a, b) => a + b, 0) || 1;
                const percent = (report.sensitivityLevelDist[level] / total) * 100;
                return (
                  <View key={level} className={styles.levelBar}>
                    <Text className={styles.levelName}>{SENSITIVITY_CONFIG[level].label}</Text>
                    <View className={styles.levelTrack}>
                      <View
                        className={styles.levelFill}
                        style={{ width: `${percent}%`, background: COLORS[level] }}
                      />
                    </View>
                    <Text className={styles.levelCount}>{report.sensitivityLevelDist[level]}次</Text>
                  </View>
                );
              })}
            </View>

            <Text className={styles.sectionTitle}><Text className={styles.icon}>🏆</Text> 质量等级统计</Text>
            <View className={styles.gradeBars}>
              <View className={styles.gradeBar}>
                <Text className={styles.gradeIcon}>🌟</Text>
                <Text className={`${styles.gradeCount} ${styles.excellent}`}>{report.excellentCount}</Text>
                <Text className={styles.gradeLabel}>优秀</Text>
              </View>
              <View className={styles.gradeBar}>
                <Text className={styles.gradeIcon}>👍</Text>
                <Text className={`${styles.gradeCount} ${styles.good}`}>{report.goodCount}</Text>
                <Text className={styles.gradeLabel}>良好</Text>
              </View>
              <View className={styles.gradeBar}>
                <Text className={styles.gradeIcon}>⚠️</Text>
                <Text className={`${styles.gradeCount} ${styles.poor}`}>{report.poorCount}</Text>
                <Text className={styles.gradeLabel}>待改进</Text>
              </View>
            </View>
          </View>

          <View className={styles.reportCard}>
            <Text className={styles.sectionTitle}><Text className={styles.icon}>🏗️</Text> 楼层变化情况</Text>
            <View className={styles.floorChanges}>
              {report.declinedFloors.length === 0 && report.improvedFloors.length === 0 && report.newFloors.length === 0 ? (
                <Text className={styles.emptyChanges}>暂无楼层变化</Text>
              ) : (
                <>
                  {report.declinedFloors.slice(0, 3).map(item => renderFloorChangeRow(item, 'declined'))}
                  {report.improvedFloors.slice(0, 3).map(item => renderFloorChangeRow(item, 'improved'))}
                  {report.newFloors.slice(0, 2).map(item => renderFloorChangeRow(item, 'new'))}
                </>
              )}
            </View>
          </View>

          <View className={styles.reportCard}>
            <Text className={styles.sectionTitle}><Text className={styles.icon}>🏅</Text> 楼层排行</Text>
            <View className={styles.rankSection}>
              <View className={styles.rankList}>
                <Text className={`${styles.rankTitle} ${styles.top}`}>TOP 3 最佳</Text>
                {report.topFloors.length > 0 ? (
                  report.topFloors.map((item, idx) => (
                    <View key={`top-${item.floor}`} className={styles.rankItem}>
                      <View
                        className={styles.rankBadge}
                        style={{ background: renderRankBadgeColor(idx) }}
                      >
                        {idx + 1}
                      </View>
                      <Text className={styles.rankFloor}>{item.floor}楼</Text>
                      <Text
                        className={styles.rankScore}
                        style={{
                          color: item.grade === 'excellent' ? GRADE_CONFIG.excellent.color :
                                 item.grade === 'good' ? GRADE_CONFIG.good.color :
                                 GRADE_CONFIG.poor.color
                        }}
                      >
                        {item.avgScore}分
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text className={styles.emptyRank}>暂无数据</Text>
                )}
              </View>
              <View className={styles.rankList}>
                <Text className={`${styles.rankTitle} ${styles.bottom}`}>需关注 TOP3</Text>
                {report.bottomFloors.length > 0 ? (
                  report.bottomFloors.map((item, idx) => (
                    <View key={`bottom-${item.floor}`} className={styles.rankItem}>
                      <View
                        className={styles.rankBadge}
                        style={{ background: renderRankBadgeColor(idx) }}
                      >
                        {idx + 1}
                      </View>
                      <Text className={styles.rankFloor}>{item.floor}楼</Text>
                      <Text
                        className={styles.rankScore}
                        style={{
                          color: item.grade === 'excellent' ? GRADE_CONFIG.excellent.color :
                                 item.grade === 'good' ? GRADE_CONFIG.good.color :
                                 GRADE_CONFIG.poor.color
                        }}
                      >
                        {item.avgScore}分
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text className={styles.emptyRank}>暂无数据</Text>
                )}
              </View>
            </View>
          </View>

          {report.blindSpotCount > 0 && (
            <View className={styles.reportCard}>
              <View className={styles.blindSpotInfo}>
                <Text className={styles.blindSpotTitle}>
                  👁️ 盲区提醒
                </Text>
                <Text className={styles.blindSpotText}>
                  检测到 {report.blindSpotCount} 次盲区情况，涉及楼层: {report.blindSpotFloors.map(f => `${f}楼`).join('、')}
                </Text>
              </View>
            </View>
          )}

          <View className={styles.reportCard}>
            <Text className={styles.sectionTitle}><Text className={styles.icon}>👥</Text> 贡献榜</Text>
            {report.contributors.length > 0 ? (
              <View className={styles.contributors}>
                {report.contributors.map(c => (
                  <View key={c.testerName} className={styles.contributorRow}>
                    <View className={styles.contributorAvatar}>
                      {c.testerName.charAt(0)}
                    </View>
                    <Text className={styles.contributorName}>{c.testerName}</Text>
                    <Text className={styles.contributorCount}>{c.testCount}次</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className={styles.emptyContributors}>暂无贡献数据</Text>
            )}
          </View>

          <Canvas
            id="reportCanvas"
            type="2d"
            className={styles.previewCanvas}
          />
        </>
      )}

      {report && (
        <View className={styles.footerActions}>
          <Button className={`${styles.actionBtn} ${styles.secondary}`} onClick={handleShare}>
            📤 分享
          </Button>
          <Button className={`${styles.actionBtn} ${styles.primary}`} onClick={handleSaveImage}>
            💾 保存为图片
          </Button>
        </View>
      )}

      {isSaving && (
        <View className={styles.savingOverlay}>
          <View className={styles.savingBox}>
            <View className={styles.loading} />
            <Text className={styles.savingText}>生成图片中...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default ReportPage;
