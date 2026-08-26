import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TextStyle, View, ViewStyle, StyleProp } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  fill?: number;
  numberOfLines?: number;
};

const REF = 120;

export default function FitText({ text, style, fill = 0.92, numberOfLines = 2 }: Props) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [m, setM] = useState({ w: 0, h: 0 });
  const [fs, setFs] = useState(64);

  const onBox = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((p) => (p.w === width && p.h === height ? p : { w: width, h: height }));
  };
  const onM = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setM((p) => (p.w === width && p.h === height ? p : { w: width, h: height }));
  };

  let target = fs;
  if (box.w > 0 && box.h > 0 && m.w > 0 && m.h > 0) {
    const scale = Math.min(box.w / m.w, box.h / m.h) * fill;
    target = Math.max(12, Math.floor(REF * scale));
  }

  return (
    <View style={styles.box} onLayout={onBox}>
      <Text
        style={[style, styles.measure, { fontSize: REF, width: box.w || undefined }]}
        numberOfLines={numberOfLines}
        onLayout={onM}
        allowFontScaling={false}
      >
        {text}
      </Text>
      <Text style={[style, { fontSize: target }]} numberOfLines={numberOfLines} allowFontScaling={false}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0, textAlign: 'center' },
});

export type FitTextStyle = ViewStyle;
