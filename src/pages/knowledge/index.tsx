import React, { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import styles from './index.module.scss';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  icon: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    question: '声控灯为什么不亮了？',
    answer: '声控灯不亮可能有以下原因：① 灯泡烧坏或接触不良；② 声控传感器故障；③ 电路或开关损坏；④ 白天光线充足时光敏电阻处于断开状态（属于正常现象）；⑤ 电源断电。建议先检查灯泡是否损坏，再排查其他原因。',
    icon: '💡'
  },
  {
    id: 2,
    question: '声控灯灵敏度怎么调？',
    answer: '大多数声控灯的底座或内部电路板上有一个可调电阻（电位器），可以通过旋转它来调节灵敏度。顺时针旋转通常提高灵敏度（小声即可触发），逆时针则降低灵敏度。部分新型声控灯可通过配套APP调节。调节时注意断电操作，避免触电。',
    icon: '🎚️'
  },
  {
    id: 3,
    question: '声控灯一般寿命多久？',
    answer: '声控灯的寿命主要取决于灯泡类型和使用频率。LED声控灯通常可使用2-5年，传统白炽灯约1-2年。声控传感器本身寿命较长，正常使用可达5年以上。频繁开关会缩短使用寿命，建议选择质量可靠的品牌产品。',
    icon: '⏱️'
  },
  {
    id: 4,
    question: '更换声控灯费用大概多少？',
    answer: '普通声控灯座价格在20-50元之间，LED灯泡10-30元。如果需要请电工上门安装，人工费约50-100元。整体更换一套声控灯（含安装）费用约100-200元。品牌产品和特殊功能（如带消防认证）价格会更高。',
    icon: '💰'
  },
  {
    id: 5,
    question: '声控灯一直亮不灭怎么办？',
    answer: '声控灯常亮可能是：① 光敏电阻损坏，无法检测光线；② 声控电路故障，继电器粘连；③ 环境持续有噪音触发。建议先检查周围是否有持续声源，再考虑更换声控开关。',
    icon: '🔧'
  },
  {
    id: 6,
    question: '声控灯耗电吗？',
    answer: '声控灯本身待机功耗很低，约0.5-2W，一年待机耗电约1-3度，非常省电。LED声控灯整体能耗相比普通长明灯节能90%以上，是环保节能的照明选择。',
    icon: '⚡'
  },
  {
    id: 7,
    question: '声控灯和人体感应灯哪个好？',
    answer: '声控灯适合楼道、走廊等场所，靠声音触发，成本较低；人体感应灯靠红外感应，灵敏度高，不会被外界噪音误触发，但成本较高。可根据具体使用场景和预算选择。',
    icon: '🤔'
  },
  {
    id: 8,
    question: '下雨天声控灯频繁亮正常吗？',
    answer: '雨天雷声、雨声较大时，声控灯频繁亮起属于正常现象。如果过于敏感影响使用，可以适当降低灵敏度，或更换带延时功能的声控开关。',
    icon: '🌧️'
  }
];

const KnowledgePage: React.FC = () => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleItem = (id: number) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  return (
    <ScrollView className={styles.container} scrollY>
      <View className={styles.header}>
        <View className={styles.headerContent}>
          <Text className={styles.title}>声控灯小知识</Text>
          <Text className={styles.subtitle}>了解声控灯，让生活更便利</Text>
        </View>
        <View className={styles.iconBox}>
          <Text className={styles.bulbIcon}>💡</Text>
        </View>
      </View>

      <View className={styles.introCard}>
        <Text className={styles.introText}>
          声控灯是一种通过声音控制开关的智能照明设备，广泛应用于楼道、走廊等公共场所。
          了解这些常见问题，帮助您更好地使用和维护声控灯。
        </Text>
      </View>

      <View className={styles.faqList}>
        {FAQ_DATA.map((item) => {
          const isExpanded = expandedIds.has(item.id);
          return (
            <View
              key={item.id}
              className={`${styles.faqItem} ${isExpanded ? styles.expanded : ''}`}
            >
              <View
                className={styles.questionRow}
                onClick={() => toggleItem(item.id)}
              >
                <View className={styles.questionLeft}>
                  <Text className={styles.questionIcon}>{item.icon}</Text>
                  <Text className={styles.questionText}>{item.question}</Text>
                </View>
                <Text className={`${styles.arrow} ${isExpanded ? styles.arrowUp : ''}`}>
                  ▾
                </Text>
              </View>

              {isExpanded && (
                <View className={styles.answerContainer}>
                  <View className={styles.answerDivider} />
                  <Text className={styles.answerText}>{item.answer}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View className={styles.tipCard}>
        <Text className={styles.tipTitle}>💡 温馨提示</Text>
        <Text className={styles.tipText}>
          定期测试声控灯的灵敏度和功能，发现问题及时报修或更换。
          共同维护良好的楼道照明环境，保障夜间出行安全。
        </Text>
      </View>
    </ScrollView>
  );
};

export default KnowledgePage;
