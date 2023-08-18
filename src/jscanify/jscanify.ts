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
    options.color = options.color ?? "orange";
    options.thickness = options.thickness ?? 8;
    options.detectedCrop = options.detectedCrop ?? (() => { });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = cv.imread(image);
    const maxContour = this.findPaperContour(img);

    cv.imshow(canvas, img);

    // desenha o retangulo de referencia
    const PADD = 30
    ctx.lineWidth = 2;
    ctx.strokeStyle = "blue";
    ctx.rect(PADD, PADD, image.clientWidth - PADD * 2, image.clientHeight - PADD * 2);
    ctx.stroke();

    if (maxContour) {

      const rect = this.getCornerPoints(maxContour);
      const { topL, topR, botL, botR } = rect;

      if (topL && topR && botL && botR) {

        // verifica se o retangulo de referencia contem o retangulo de teste
        const rectRef = new cv.Rect(PADD, PADD, image.clientWidth - PADD * 2, image.clientHeight - PADD * 2);
        const isBetterFraming = this.detectBetterFraming(rectRef, rect);

        // somente desenha contorno se já estiver descolado da borda externa
        if (topL.x > 0 && topL.y > 0) {

          ctx.strokeStyle = isBetterFraming ? "green" : options.color;
          ctx.lineWidth = options.thickness!;

          ctx.beginPath();
          ctx.moveTo(topL.x, topL.y);
          ctx.lineTo(topR.x, topR.y);
          ctx.lineTo(botR.x, botR.y);
          ctx.lineTo(botL.x, botL.y);
          ctx.lineTo(topL.x, topL.y);
          ctx.stroke();
        }

        // if (detected) {
        //   const extracted = this.extractPaper(image, image.width, image.height);
        //   options.detectedCrop(extracted);
        // }
      }
    }

    img.delete();
    maxContour.delete(); // TODO: check if these need to be deleted

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
  extractPaper(image: any, resultWidth: number, resultHeight: number, cornerPoints?: any) {

    const img = cv.imread(image);
    const maxContour = this.findPaperContour(img);
    const { topL, topR, botL, botR } = cornerPoints || this.getCornerPoints(maxContour);

    let warpedDst = new cv.Mat();
    let dsize = new cv.Size(resultWidth, resultHeight);
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [topL.x, topL.y, topR.x, topR.y, botL.x, botL.y, botR.x, botR.y]);
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, resultWidth, 0, 0, resultHeight, resultWidth, resultHeight]);

    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(img, warpedDst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    const canvas = document.createElement("canvas");
    cv.imshow(canvas, warpedDst);

    img.delete()
    warpedDst.delete()
    srcTri.delete() // TODO: check if these need to be deleted
    dstTri.delete() // TODO: check if these need to be deleted

    return canvas;
  }

  // verifica se o retangulo de referencia contem o retangulo de teste
  detectBetterFraming(rectRef: Rect, rectTest: IRect): boolean {
    return !((rectTest.topL.x == 0 && rectTest.topL.y == 0) ||
      rectRef.contains(rectTest.topL) || rectRef.contains(rectTest.topR) ||
      rectRef.contains(rectTest.botL) || rectRef.contains(rectTest.botR))
  }


  /**
   * Calculates the corner points of a contour.
   * @param {*} contour contour from {@link findPaperContour}
   * @returns object with properties `topLeftCorner`, `topRightCorner`, `bottomLeftCorner`, `bottomRightCorner`, each with `x` and `y` property
   */
  getCornerPoints(contour: Mat): IRect {

    const rect: IRect = {} as IRect;
    let topLDist = 0;
    let topRDist = 0;
    let botLDist = 0;
    let botRDist = 0;

    let areaRect = cv.minAreaRect(contour);
    const center = areaRect.center;

    for (let i = 0; i < contour.data32S.length; i += 2) {

      const point = { x: contour.data32S[i], y: contour.data32S[i + 1] } as Point;
      const dist = distance(point, center);

      if (point.x < center.x && point.y < center.y) {
        // top left
        if (dist > topLDist) {
          rect.topL = point;
          topLDist = dist;
        }
      } else if (point.x > center.x && point.y < center.y) {
        // top right
        if (dist > topRDist) {
          rect.topR = point;
          topRDist = dist;
        }
      } else if (point.x < center.x && point.y > center.y) {
        // bottom left
        if (dist > botLDist) {
          rect.botL = point;
          botLDist = dist;
        }
      } else if (point.x > center.x && point.y > center.y) {
        // bottom right
        if (dist > botRDist) {
          rect.botR = point;
          botRDist = dist;
        }
      }
    }
    return rect;
  }
}

interface IRect {
  topL: Point;
  topR: Point;
  botL: Point;
  botR: Point;
}

export interface IOptions {
  color?: string;
  thickness?: number;
  detectedCrop?: (canvas?: HTMLCanvasElement) => void;
}

// implementa metodo contains para Rect
cv.Rect.prototype.contains = function (point: Point) {
  return point.x >= this.x && point.x <= this.x + this.width && point.y >= this.y && point.y <= this.y + this.height;
}
