/*! jscanify v1.2.0 | (c) ColonelParrot and other contributors | MIT License */

import cv, { Mat, Point, Rect } from "opencv-ts";

/**
 * Calculates distance between two points. Each point must have `x` and `y` property
 * @param {*} p1 point 1
 * @param {*} p2 point 2
 * @returns distance between two points
 */
export function distance(p1: Point, p2: Point) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

export default class JScanify {

  /**
   * Finds the contour of the paper within the image
   * @param {*} image image to process (cv.Mat)
   * @returns the biggest contour inside the image
   */
  findPaperContour(image: Mat): Mat {
    const imgGray = new cv.Mat();
    cv.cvtColor(image, imgGray, cv.COLOR_RGBA2GRAY);

    const imgBlur = new cv.Mat();
    cv.GaussianBlur(imgGray, imgBlur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    const imgThresh = new cv.Mat();
    cv.threshold(imgBlur, imgThresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(imgThresh, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let maxContourIndex = -1;

    for (let i = 0; i < contours.size(); ++i) {
      let contourArea = cv.contourArea(contours.get(i));
      if (contourArea > maxArea) {
        maxArea = contourArea;
        maxContourIndex = i;
      }
    }

    const maxContour = contours.get(maxContourIndex);

    imgGray.delete();
    imgBlur.delete();
    imgThresh.delete();
    contours.delete();
    hierarchy.delete();

    return maxContour;
  }

  /**
   * Highlights the paper detected inside the image.
   * @param {*} image image to process
   * @param {*} options options for highlighting. Accepts `color` and `thickness` parameter
   * @returns `HTMLCanvasElement` with original image and paper highlighted
   */
  highlightPaper(image: HTMLCanvasElement, options?: IOptions) {

    options = options ?? {};
    options.showRefRect = options.showRefRect ?? false;
    options.detectedCrop = options.detectedCrop ?? (() => { });
    options.padding = Math.round(options.padding ?? 30);

    //console.debug('OPTIONS', options)

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const img = cv.imread(image);
    const maxContour = this.findPaperContour(img);

    cv.imshow(canvas, img);

    // desenha o retangulo de referencia
    if (options.showRefRect) {
      ctx.lineWidth = window.devicePixelRatio * 3;
      ctx.strokeStyle = "blue";
      ctx.rect(options.padding, options.padding, image.width - options.padding * 2, image.height - options.padding * 2);
      ctx.stroke();
    }

    if (maxContour) {

      const rect = this.getCornerPoints(maxContour);
      const { tl, tr, bl, br } = rect;

      if (tl && tr && bl && br) {

        // verifica se o retangulo de referencia contem o retangulo de teste
        const rectRef = new cv.Rect(options.padding, options.padding, image.width - options.padding * 2, image.height - options.padding * 2);
        const isBetterFraming = this.detectBetterFraming(rectRef, rect);

        // somente desenha contorno se já estiver descolado da borda externa
        if (tl.x > 0 && tl.y > 0) {

          ctx.strokeStyle = isBetterFraming ? "green" : "red";
          ctx.lineWidth = window.devicePixelRatio * 10;

          // desenha o contorno
          ctx.beginPath();
          ctx.moveTo(tl.x, tl.y);
          ctx.lineTo(tr.x, tr.y);
          ctx.lineTo(br.x, br.y);
          ctx.lineTo(bl.x, bl.y);
          ctx.lineTo(tl.x, tl.y);
          ctx.stroke();
        }

        // se detectou melhor enquadramento, extrai o documento
        if (isBetterFraming) {
          const extracted = this.extractPaper(image, image.width, image.height, rect);
          options.detectedCrop(extracted);
        }
      }
    }

    img.delete();
    maxContour.delete();

    return canvas;
  }

  /**
   * Extracts and undistorts the image detected within the frame.
   * @param {*} image image to process
   * @param {*} resultWidth desired result paper width
   * @param {*} resultHeight desired result paper height
   * @param {*} cornerPoints optional custom corner points, in case automatic corner points are incorrect
   * @returns `HTMLCanvasElement` containing undistorted image
   */
  extractPaper(image: any, resultWidth: number, resultHeight: number, cornerPoints?: IRect) {

    const img = cv.imread(image);
    const maxContour = this.findPaperContour(img);
    const { tl, tr, bl, br } = cornerPoints || this.getCornerPoints(maxContour);

    let warpedDst = new cv.Mat();
    let dsize = new cv.Size(resultWidth, resultHeight);
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x - 5, tl.y - 5, tr.x + 5, tr.y - 5, bl.x - 5, bl.y + 5, br.x + 5, br.y + 5]);
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, resultWidth, 0, 0, resultHeight, resultWidth, resultHeight]);

    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(img, warpedDst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    const canvas = document.createElement("canvas");
    cv.imshow(canvas, warpedDst);

    img.delete()
    warpedDst.delete()
    srcTri.delete()
    dstTri.delete()

    return canvas;
  }

  // verifica se o retangulo de referencia contem o retangulo de teste
  detectBetterFraming(rectRef: Rect, rectTest: IRect): boolean {
    return !(rectTest.tl.x == 0 || rectTest.tl.y == 0 || rectTest.bl.x == 0 || rectTest.tr.y == 0 ||
      rectRef.contains(rectTest.tl) || rectRef.contains(rectTest.tr) ||
      rectRef.contains(rectTest.bl) || rectRef.contains(rectTest.br))
  }

  /**
   * Calculates the corner points of a contour.
   * @param {*} contour contour from {@link findPaperContour}
   * @returns object with properties `topLeftCorner`, `topRightCorner`, `bottomLeftCorner`, `bottomRightCorner`, each with `x` and `y` property
   */
  getCornerPoints(contour: Mat): IRect {

    const rect: IRect = {} as IRect;
    let tlDist = 0;
    let trDist = 0;
    let blDist = 0;
    let brDist = 0;

    let areaRect = cv.minAreaRect(contour);
    const center = areaRect.center;

    for (let i = 0; i < contour.data32S.length; i += 2) {

      const point = { x: contour.data32S[i], y: contour.data32S[i + 1] } as Point;
      const dist = distance(point, center);

      if (point.x < center.x && point.y < center.y) {
        // top left
        if (dist > tlDist) {
          rect.tl = point;
          tlDist = dist;
        }
      } else if (point.x > center.x && point.y < center.y) {
        // top right
        if (dist > trDist) {
          rect.tr = point;
          trDist = dist;
        }
      } else if (point.x < center.x && point.y > center.y) {
        // bottom left
        if (dist > blDist) {
          rect.bl = point;
          blDist = dist;
        }
      } else if (point.x > center.x && point.y > center.y) {
        // bottom right
        if (dist > brDist) {
          rect.br = point;
          brDist = dist;
        }
      }
    }
    return rect;
  }
}

interface IRect {
  tl: Point; // top left
  tr: Point; // top right
  bl: Point; // bottom left
  br: Point; // bottom right
}

export interface IOptions {
  /**
   * true to show the reference rectangle
   */
  showRefRect?: boolean;
  /**
   * space between the detected paper and the frame
   */
  padding?: number;
  /**
   * callback function called when paper is detected
   * @param canvas canvas element containing the detected paper
   */
  detectedCrop?: (canvas: HTMLCanvasElement) => void;
}

// implementa metodo contains para Rect
cv.Rect.prototype.contains = function (point: Point) {
  return point.x >= this.x && point.x <= this.x + this.width && point.y >= this.y && point.y <= this.y + this.height;
}
