/*! jscanify v1.2.0 | (c) ColonelParrot and other contributors | MIT License */

import cv, { Mat, Point } from "opencv-ts";

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
   * @param {*} img image to process (cv.Mat)
   * @returns the biggest contour inside the image
   */
  findPaperContour(img: any): Mat {
    const imgGray = new cv.Mat();
    cv.cvtColor(img, imgGray, cv.COLOR_RGBA2GRAY);

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
    options.cbPaperCrop = options.cbPaperCrop ?? (() => { });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = cv.imread(image);
    const maxContour = this.findPaperContour(img);

    cv.imshow(canvas, img);

    if (maxContour) {

      const { topL, topR, botL, botR } = this.getCornerPoints(maxContour);

      if (topL && topR && botL && botR) {

        let detected = (topL.x > 0 && topL.y > 0 &&
          topR.x < image.clientWidth && topR.y > 0 &&
          botL.x > 0 && botL.y < image.clientHeight &&
          botR.x < image.clientWidth && botR.y < image.clientHeight);

        ctx.strokeStyle = detected ? "green" : options.color;
        ctx.lineWidth = options.thickness!;

        ctx.beginPath();
        ctx.moveTo(topL.x, topL.y);
        ctx.lineTo(topR.x, topR.y);
        ctx.lineTo(botR.x, botR.y);
        ctx.lineTo(botL.x, botL.y);
        ctx.lineTo(topL.x, topL.y);
        ctx.stroke();

        if (detected) {
          const extracted = this.extractPaper(image, image.width, image.height);
          options.cbPaperCrop(extracted);
        }
      }
    }

    img.delete();

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

    const canvas = document.createElement("canvas");
    const img = cv.imread(image);
    const maxContour = this.findPaperContour(img);
    const { topL, topR, botL, botR } = cornerPoints || this.getCornerPoints(maxContour);

    let warpedDst = new cv.Mat();
    let dsize = new cv.Size(resultWidth, resultHeight);
    let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [topL.x, topL.y, topR.x, topR.y, botL.x, botL.y, botR.x, botR.y,]);
    let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, resultWidth, 0, 0, resultHeight, resultWidth, resultHeight,]);

    let M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(img, warpedDst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    cv.imshow(canvas, warpedDst);

    img.delete()
    warpedDst.delete()
    srcTri.delete() // TODO: check if these need to be deleted

    return canvas;
  }

  /**
   * Calculates the corner points of a contour.
   * @param {*} contour contour from {@link findPaperContour}
   * @returns object with properties `topLeftCorner`, `topRightCorner`, `bottomLeftCorner`, `bottomRightCorner`, each with `x` and `y` property
   */
  getCornerPoints(contour: Mat) {

    let rect = cv.minAreaRect(contour);
    const center = rect.center;

    let topL;
    let topLDist = 0;

    let topR;
    let topRDist = 0;

    let botL;
    let botLDist = 0;

    let botR;
    let botRDist = 0;

    for (let i = 0; i < contour.data32S.length; i += 2) {

      const point = { x: contour.data32S[i], y: contour.data32S[i + 1] } as Point;
      const dist = distance(point, center);

      if (point.x < center.x && point.y < center.y) {
        // top left
        if (dist > topLDist) {
          topL = point;
          topLDist = dist;
        }
      } else if (point.x > center.x && point.y < center.y) {
        // top right
        if (dist > topRDist) {
          topR = point;
          topRDist = dist;
        }
      } else if (point.x < center.x && point.y > center.y) {
        // bottom left
        if (dist > botLDist) {
          botL = point;
          botLDist = dist;
        }
      } else if (point.x > center.x && point.y > center.y) {
        // bottom right
        if (dist > botRDist) {
          botR = point;
          botRDist = dist;
        }
      }
    }

    return { topL, topR, botL, botR };
  }
}


export interface IOptions {
  color?: string;
  thickness?: number;
  cbPaperCrop?: (canvas?: HTMLCanvasElement) => void;
}
