import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TAB, pillPath } from '@/constants/tabBar';

/**
 * The pill and its crest as one silhouette. The shadow is native: the wrapper
 * has no background, so iOS casts it from the drawn shape (crest included)
 * rather than from a rectangle.
 */
function TabBarShape({ width }: { width: number }) {
  const d = pillPath(width);
  const h = TAB.height + TAB.headroom;
  return (
    <View pointerEvents="none" style={[styles.shadow, { width, height: h }]}>
      <Svg width={width} height={h} viewBox={`0 ${-TAB.headroom} ${width} ${h}`}>
        {/* 2 pt edge under the fill, so 1 pt shows outside the shape. */}
        <Path d={d} fill={TAB.pillEdge} stroke={TAB.pillEdge} strokeWidth={2} strokeLinejoin="round" />
        <Path d={d} fill={TAB.pill} />
      </Svg>
    </View>
  );
}

export default memo(TabBarShape);

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: 'transparent',
    shadowColor: TAB.shadowPill.color,
    shadowOpacity: TAB.shadowPill.opacity,
    shadowRadius: TAB.shadowPill.radius,
    shadowOffset: { width: 0, height: TAB.shadowPill.dy },
  },
});
