import { FC, useEffect, useRef } from 'react'
import { View, Canvas } from '@tarojs/components'
import { CanvasContext, createCanvasContext, canvasToTempFilePath, previewImage } from '@tarojs/taro'
import { Button, Flex } from '@taroify/core'
import './index.scss'

const Index: FC = () => {
  const ref = useRef<CanvasContext>()
  const config = useRef<any>()
  useEffect(() => {
    ref.current = createCanvasContext('writeBox')
    config.current = {
      canvasWidth: 343,
      canvasHeight: 616,
      transparent: 1, // 透明度
      selectColor: 'black',
      lineColor: '#2677FF', // 颜色
      lineSize: 1.5,  // 笔记倍数
      lineMin: 0.5,   // 最小笔画半径
      lineMax: 4,     // 最大笔画半径
      pressure: 1,     // 默认压力
      smoothness: 60,  //顺滑度，用60的距离来计算速度
      currentPoint: {},
      currentLine: [],  // 当前线条
      firstTouch: true, // 第一次触发
      radius: 1, //画圆的半径
      cutArea: { top: 0, right: 0, bottom: 0, left: 0 }, //裁剪区域
      bethelPoint: [],  //保存所有线条 生成的贝塞尔点；
      lastPoint: 0,
      chirography: [], //笔迹
      currentChirography: {}, //当前笔迹
      linePrack: [], //划线轨迹 , 生成线条的实际点,
    }
  }, [])

  const onTouchStart = (e) => {
    console.log('onTouchStart', e);
    if (e.type != 'touchstart') return false;
    ref.current?.setFillStyle(config.current.lineColor);  // 初始线条设置颜色
    ref.current?.setGlobalAlpha(config.current.transparent);  // 设置半透明
    let currentPoint = {
      x: e.touches[0].x,
      y: e.touches[0].y
    }
    let currentLine = config.current.currentLine;
    currentLine.unshift({
      time: new Date().getTime(),
      dis: 0,
      x: currentPoint.x,
      y: currentPoint.y
    })
    config.current.currentPoint = currentPoint

    if (config.current.firstTouch) {
      config.current.cutArea = { top: currentPoint.y, right: currentPoint.x, bottom: currentPoint.y, left: currentPoint.x }
      config.current.firstTouch = false
    }
    pointToLine(currentLine);

  }
  const onTouchMove = (e) => {
    if (e.type != 'touchmove') return false;
    if (e.cancelable) {
      // 判断默认行为是否已经被禁用
      if (!e.defaultPrevented) {
        e.preventDefault();
      }
    }
    let point = {
      x: e.touches[0].x,
      y: e.touches[0].y
    }

    //测试裁剪
    if (point.y < config.current.cutArea.top) {
      config.current.cutArea.top = point.y;
    }
    if (point.y < 0) config.current.cutArea.top = 0;

    if (point.x > config.current.cutArea.right) {
      config.current.cutArea.right = point.x;
    }
    if (config.current.canvasWidth - point.x <= 0) {
      config.current.cutArea.right = config.current.canvasWidth;
    }
    if (point.y > config.current.cutArea.bottom) {
      config.current.cutArea.bottom = point.y;
    }
    if (config.current.canvasHeight - point.y <= 0) {
      config.current.cutArea.bottom = config.current.canvasHeight;
    }
    if (point.x < config.current.cutArea.left) {
      config.current.cutArea.left = point.x;
    }
    if (point.x < 0) config.current.cutArea.left = 0;


    config.current.lastPoint = config.current.currentPoint
    config.current.currentPoint = point

    let currentLine = config.current.currentLine
    currentLine.unshift({
      time: new Date().getTime(),
      dis: distance(config.current.currentPoint, config.current.lastPoint),
      x: point.x,
      y: point.y
    })
    pointToLine(currentLine);
  }
  const onTouchEnd = (e) => {
    console.log('onTouchEnd', e);
    if (e.type != 'touchend') return 0;
    let point = {
      x: e.changedTouches[0].x,
      y: e.changedTouches[0].y
    }
    config.current.lastPoint = config.current.currentPoint
    config.current.currentPoint = point

    let currentLine = config.current.currentLine
    currentLine.unshift({
      time: new Date().getTime(),
      dis: distance(config.current.currentPoint, config.current.lastPoint),
      x: point.x,
      y: point.y
    })
    //一笔结束，保存笔迹的坐标点，清空，当前笔迹
    //增加判断是否在手写区域；
    pointToLine(currentLine);

    var currentChirography = {
      lineSize: config.current.lineSize,
      lineColor: config.current.lineColor
    };
    var chirography = config.current.chirography
    chirography.unshift(currentChirography);
    config.current.chirography = chirography
    var linePrack = config.current.linePrack
    linePrack.unshift(config.current.currentLine);
    config.current.linePrack = linePrack
    config.current.currentLine = []
  }
  const pointToLine = (line) => {
    if (line.length <= 1) {
      line[0].r = config.current.radius;
      return;
    }
    let x0, x1, x2, y0, y1, y2, r0, r1, r2, len, lastRadius, dis = 0, time = 0, curveValue = 0.5;
    if (line.length <= 2) {
      x0 = line[1].x
      y0 = line[1].y
      x2 = line[1].x + (line[0].x - line[1].x) * curveValue;
      y2 = line[1].y + (line[0].y - line[1].y) * curveValue;
      //x2 = line[1].x;
      //y2 = line[1].y;
      x1 = x0 + (x2 - x0) * curveValue;
      y1 = y0 + (y2 - y0) * curveValue;;

    } else {
      x0 = line[2].x + (line[1].x - line[2].x) * curveValue;
      y0 = line[2].y + (line[1].y - line[2].y) * curveValue;
      x1 = line[1].x;
      y1 = line[1].y;
      x2 = x1 + (line[0].x - x1) * curveValue;
      y2 = y1 + (line[0].y - y1) * curveValue;
    }
    //从计算公式看，三个点分别是(x0,y0),(x1,y1),(x2,y2) ；(x1,y1)这个是控制点，控制点不会落在曲线上；实际上，这个点还会手写获取的实际点，却落在曲线上
    len = distance({ x: x2, y: y2 }, { x: x0, y: y0 });
    lastRadius = config.current.radius;
    for (let n = 0; n < line.length - 1; n++) {
      dis += line[n].dis;
      time += line[n].time - line[n + 1].time;
      if (dis > config.current.smoothness) break;
    }
    config.current.radius = Math.min(time / len * config.current.pressure + config.current.lineMin, config.current.lineMax) * config.current.lineSize
    line[0].r = config.current.radius;
    //计算笔迹半径；
    if (line.length <= 2) {
      r0 = (lastRadius + config.current.radius) / 2;
      r1 = r0;
      r2 = r1;
      //return;
    } else {
      r0 = (line[2].r + line[1].r) / 2;
      r1 = line[1].r;
      r2 = (line[1].r + line[0].r) / 2;
    }
    let n = 5;
    let point: any = [];
    for (let i = 0; i < n; i++) {
      let t = i / (n - 1);
      let x = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * x1 + t * t * x2;
      let y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * y1 + t * t * y2;
      let r = lastRadius + (config.current.radius - lastRadius) / n * i;
      point.push({ x: x, y: y, r: r });
      if (point.length == 3) {
        let a = ctaCalc(point[0].x, point[0].y, point[0].r, point[1].x, point[1].y, point[1].r, point[2].x, point[2].y, point[2].r);
        a[0].color = config.current.lineColor;
        // let bethelPoint = config.current.bethelPoint;
        // console.log(a)
        // console.log(config.current.bethelPoint)
        // bethelPoint = bethelPoint.push(a);
        bethelDraw(a, 1);
        point = [{ x: x, y: y, r: r }];
      }
    }
    config.current.currentLine = line
  }

  const distance = (a, b) => {
    let x = b.x - a.x;
    let y = b.y - a.y;
    return Math.sqrt(x * x + y * y);
  }

  const ctaCalc = (x0, y0, r0, x1, y1, r1, x2, y2, r2) => {
    let a: any = [], vx01, vy01, norm, n_x0, n_y0, vx21, vy21, n_x2, n_y2;
    vx01 = x1 - x0;
    vy01 = y1 - y0;
    norm = Math.sqrt(vx01 * vx01 + vy01 * vy01 + 0.0001) * 2;
    vx01 = vx01 / norm * r0;
    vy01 = vy01 / norm * r0;
    n_x0 = vy01;
    n_y0 = -vx01;
    vx21 = x1 - x2;
    vy21 = y1 - y2;
    norm = Math.sqrt(vx21 * vx21 + vy21 * vy21 + 0.0001) * 2;
    vx21 = vx21 / norm * r2;
    vy21 = vy21 / norm * r2;
    n_x2 = -vy21;
    n_y2 = vx21;
    a.push({ mx: x0 + n_x0, my: y0 + n_y0, color: "#1A1A1A" });
    a.push({ c1x: x1 + n_x0, c1y: y1 + n_y0, c2x: x1 + n_x2, c2y: y1 + n_y2, ex: x2 + n_x2, ey: y2 + n_y2 });
    a.push({ c1x: x2 + n_x2 - vx21, c1y: y2 + n_y2 - vy21, c2x: x2 - n_x2 - vx21, c2y: y2 - n_y2 - vy21, ex: x2 - n_x2, ey: y2 - n_y2 });
    a.push({ c1x: x1 - n_x2, c1y: y1 - n_y2, c2x: x1 - n_x0, c2y: y1 - n_y0, ex: x0 - n_x0, ey: y0 - n_y0 });
    a.push({ c1x: x0 - n_x0 - vx01, c1y: y0 - n_y0 - vy01, c2x: x0 + n_x0 - vx01, c2y: y0 + n_y0 - vy01, ex: x0 + n_x0, ey: y0 + n_y0 });
    a[0].mx = a[0].mx.toFixed(1);
    a[0].mx = parseFloat(a[0].mx);
    a[0].my = a[0].my.toFixed(1);
    a[0].my = parseFloat(a[0].my);
    for (let i = 1; i < a.length; i++) {
      a[i].c1x = a[i].c1x.toFixed(1);
      a[i].c1x = parseFloat(a[i].c1x);
      a[i].c1y = a[i].c1y.toFixed(1);
      a[i].c1y = parseFloat(a[i].c1y);
      a[i].c2x = a[i].c2x.toFixed(1);
      a[i].c2x = parseFloat(a[i].c2x);
      a[i].c2y = a[i].c2y.toFixed(1);
      a[i].c2y = parseFloat(a[i].c2y);
      a[i].ex = a[i].ex.toFixed(1);
      a[i].ex = parseFloat(a[i].ex);
      a[i].ey = a[i].ey.toFixed(1);
      a[i].ey = parseFloat(a[i].ey);
    }
    return a;
  }
  const bethelDraw = (point, is_fill, color?) => {
    ref.current?.beginPath();
    ref.current?.moveTo(point[0].mx, point[0].my);
    if (undefined != color) {
      ref.current?.setFillStyle(color);
      ref.current?.setStrokeStyle(color);
    } else {
      ref.current?.setFillStyle(point[0].color);
      ref.current?.setStrokeStyle(point[0].color);
    }
    for (let i = 1; i < point.length; i++) {
      ref.current?.bezierCurveTo(point[i].c1x, point[i].c1y, point[i].c2x, point[i].c2y, point[i].ex, point[i].ey);
    }
    ref.current?.stroke();
    if (undefined != is_fill) {
      ref.current?.fill(); //填充图形 ( 后绘制的图形会覆盖前面的图形, 绘制时注意先后顺序 )
    }
    ref.current?.draw(true)
  }

  const reset = () => {
    ref.current?.clearRect(0, 0, 700, 730)
    ref.current?.draw()
  }

  const submit = () => {
    canvasToTempFilePath({
      canvasId: 'writeBox',
      // fileType: 'jpg',//加上后有白色背景，不加就是透明的
      success(res) {
        console.log(res.tempFilePath);
        previewImage({
          current: res.tempFilePath,
          urls: [res.tempFilePath]
        })
      },
      fail: function () {
        console.log('fail-downloadFile')
      }
    })
  }

  return <View className='write'>
    <View className='main' id='main'>
      <Canvas
        canvasId='writeBox'
        className='canvas'
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
    </View>
    <Flex gutter={20} justify='end'>
      <Flex.Item span={8}>
        <Button block color="warning" shape='round' size='medium' onClick={reset}>重 置</Button>
      </Flex.Item>
      <Flex.Item span={8}>
        <Button block color="primary" shape='round' size='medium' onClick={submit}>提 交</Button>
      </Flex.Item>
    </Flex>
  </View>
}

export default Index
